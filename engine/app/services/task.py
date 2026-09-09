import math
import os.path
import re
from os import path
from typing import List

from loguru import logger

from app.config import config
from app.models import const
from app.models.schema import VideoConcatMode, VideoParams
from app.services import llm, material, subtitle, twelvelabs, video, voice, upload_post
from app.services import state as sm
from app.utils import file_security, utils


def generate_script(task_id, params):
    logger.info("\n\n## generating video script")
    video_script = params.video_script.strip()
    if not video_script:
        video_script = llm.generate_script(
            video_subject=params.video_subject,
            language=params.video_language,
            paragraph_number=params.paragraph_number,
            video_script_prompt=params.video_script_prompt,
            custom_system_prompt=params.custom_system_prompt,
            product_data=getattr(params, "product_data", None),
        )
    else:
        logger.debug(f"video script: \n{video_script}")

    if not video_script:
        sm.state.update_task(task_id, state=const.TASK_STATE_FAILED)
        logger.error("failed to generate video script.")
        return None

    return video_script


def generate_terms(task_id, params, video_script):
    logger.info("\n\n## generating video terms")
    video_terms = params.video_terms
    if not video_terms:
        # 开启素材按文案顺序匹配后，关键词本身也必须按脚本叙事顺序生成；
        # 否则后续即使顺序下载和顺序拼接，也只能复用一组全局主题词，
        # 无法改善“后面内容的画面提前出现”的问题。
        video_terms = llm.generate_terms(
            video_subject=params.video_subject,
            video_script=video_script,
            amount=8 if params.match_materials_to_script else 5,
            match_script_order=params.match_materials_to_script,
        )
    if isinstance(video_terms, str):
        if video_terms.startswith("Error"):
            video_terms = [params.video_subject] if params.video_subject else ["product"]
        else:
            video_terms = [term.strip() for term in re.split(r"[,，]", video_terms)]
    elif isinstance(video_terms, list):
        video_terms = [term.strip() for term in video_terms if isinstance(term, str) and term.strip()]
    else:
        video_terms = [params.video_subject] if params.video_subject else ["product"]

    logger.debug(f"video terms: {utils.to_json(video_terms)}")

    if not video_terms:
        sm.state.update_task(task_id, state=const.TASK_STATE_FAILED)
        logger.error("failed to generate video terms.")
        return None

    # 可选的 TwelveLabs Marengo 语义重排：未启用时返回原顺序，无任何副作用。
    # 顺序匹配模式下关键词顺序本身就是脚本叙事顺序，必须保持原样，故跳过。
    if not params.match_materials_to_script:
        video_terms = twelvelabs.rerank_terms_by_subject(
            video_subject=params.video_subject,
            search_terms=video_terms,
        )

    return video_terms


def save_script_data(task_id, video_script, video_terms, params):
    script_file = path.join(utils.task_dir(task_id), "script.json")
    script_data = {
        "script": video_script,
        "search_terms": video_terms,
        "params": params,
    }

    try:
        with open(script_file, "w", encoding="utf-8") as f:
            f.write(utils.to_json(script_data))
    except PermissionError as e:
        logger.warning(f"Permission error writing {script_file}: {e}")
    except Exception as e:
        logger.error(f"Failed to write script data to {script_file}: {e}")


def resolve_custom_audio_file(task_id: str, custom_audio_file: str | None) -> str:
    requested_file = (custom_audio_file or "").strip()
    if not requested_file:
        return ""

    task_dir = utils.task_dir(task_id)
    try:
        return file_security.resolve_path_within_directory(
            task_dir,
            requested_file,
        )
    except ValueError as exc:
        task_dir_error = exc

    server_audio_file = path.realpath(
        requested_file
        if path.isabs(requested_file)
        else path.join(utils.root_dir(), requested_file)
    )
    if not path.isabs(requested_file):
        project_root = path.realpath(utils.root_dir())
        try:
            if path.commonpath([project_root, server_audio_file]) != project_root:
                raise ValueError(
                    "relative custom audio paths must stay within the project directory"
                )
        except ValueError as exc:
            raise ValueError(
                "custom audio file must be task-local or an existing server-side file"
            ) from exc

    if not path.isfile(server_audio_file):
        raise ValueError(
            "custom audio file does not exist or is not a file"
        ) from task_dir_error

    return server_audio_file


def generate_audio(task_id, params, video_script):
    '''
    Generate audio for the video script.
    If a custom audio file is provided, it will be used directly.
    There will be no subtitle maker object returned in this case.
    Otherwise, TTS will be used to generate the audio.
    Returns:
        - audio_file: path to the generated or provided audio file
        - audio_duration: duration of the audio in seconds
        - sub_maker: subtitle maker object if TTS is used, None otherwise
    '''
    logger.info("\n\n## generating audio")
    # /audio 和 /subtitle 请求模型不包含 custom_audio_file，
    # 这里统一做兼容读取，避免直调接口时抛属性错误。
    requested_custom_audio_file = getattr(params, "custom_audio_file", None)
    try:
        custom_audio_file = resolve_custom_audio_file(
            task_id, requested_custom_audio_file
        )
    except ValueError as exc:
        logger.error(
            "custom audio file is invalid, "
            f"task_id: {task_id}, path: {requested_custom_audio_file}, error: {str(exc)}"
        )
        sm.state.update_task(task_id, state=const.TASK_STATE_FAILED)
        return None, None, None

    if not custom_audio_file:
        logger.info("no custom audio file provided, using TTS to generate audio.")
        audio_file = path.join(utils.task_dir(task_id), "audio.mp3")
        target_voice = (
            params.voice_name
            if params.voice_name and params.voice_name.strip()
            else "vi-VN-HoaiMyNeural"
        )
        sub_maker = voice.tts(
            text=video_script,
            voice_name=voice.parse_voice_name(target_voice),
            voice_rate=params.voice_rate,
            voice_file=audio_file,
        )
        if sub_maker is None:
            sm.state.update_task(task_id, state=const.TASK_STATE_FAILED)
            logger.error(
                """failed to generate audio:
1. check if the language of the voice matches the language of the video script.
2. check if the network is available. If you are in China, it is recommended to use a VPN and enable the global traffic mode.
            """.strip()
            )
            return None, None, None
        audio_duration = math.ceil(voice.get_audio_duration(sub_maker))
        if audio_duration == 0:
            sm.state.update_task(task_id, state=const.TASK_STATE_FAILED)
            logger.error("failed to get audio duration.")
            return None, None, None
        return audio_file, audio_duration, sub_maker
    else:
        logger.info(f"using custom audio file: {custom_audio_file}")
        audio_duration = voice.get_audio_duration(custom_audio_file)
        if audio_duration == 0:
            sm.state.update_task(task_id, state=const.TASK_STATE_FAILED)
            logger.error("failed to get audio duration from custom audio file.")
            return None, None, None
        return custom_audio_file, audio_duration, None

def generate_subtitle(task_id, params, video_script, sub_maker, audio_file):
    '''
    Generate subtitle for the video script.
    If subtitle generation is disabled or no subtitle maker is provided, it will return an empty string.
    Otherwise, it will generate the subtitle using the specified provider.
    Returns:
        - subtitle_path: path to the generated subtitle file
    '''
    if not params.subtitle_enabled:
        logger.info("\n\n## subtitle generation disabled, skipping...")
        return ""

    logger.info("\n\n## generating subtitle")

    subtitle_path = path.join(utils.task_dir(task_id), "subtitle.srt")
    subtitle_provider = config.app.get("subtitle_provider", "edge").strip().lower()
    logger.info(f"\n\n## generating subtitle, provider: {subtitle_provider}")

    if sub_maker is None and subtitle_provider != "whisper":
        # 自定义音频不会经过 TTS，因此没有 Edge/Azure 等 TTS 返回的
        # sub_maker 时间轴。只有 Whisper 可以直接从音频文件转写字幕；
        # 其他字幕提供方继续保持原有行为，避免生成错误的空时间轴。
        logger.warning(
            "subtitle maker is missing, skip subtitle generation for provider: "
            f"{subtitle_provider}"
        )
        return ""

    subtitle_fallback = False
    if subtitle_provider == "edge":
        voice.create_subtitle(
            text=video_script, sub_maker=sub_maker, subtitle_file=subtitle_path
        )
        if not os.path.exists(subtitle_path):
            subtitle_fallback = True
            logger.warning("subtitle file not found, fallback to whisper")

    if subtitle_provider == "whisper" or subtitle_fallback:
        subtitle.create(audio_file=audio_file, subtitle_file=subtitle_path)
        logger.info("\n\n## correcting subtitle")
        subtitle.correct(subtitle_file=subtitle_path, video_script=video_script)

    subtitle_lines = subtitle.file_to_subtitles(subtitle_path)
    if not subtitle_lines:
        logger.warning(f"subtitle file is invalid: {subtitle_path}")
        return ""

    return subtitle_path


def compose_visual_timeline(
    product_clips: List[str],
    broll_clips: List[str],
    audio_duration: float,
    p0_ratio: float = 0.7,
) -> List[str]:
    """
    Combines P0 product clips and P1/P2 B-roll clips to satisfy visual priority percentages and section mapping.
    Ensures:
    1. Hook (beginning clip) is P0 Product Visual.
    2. CTA (ending clip) is P0 Product Visual hero shot.
    3. Product visuals dominate configured percentage (60-80%) of total video timeline.
    """
    if not product_clips and not broll_clips:
        return []
    if not product_clips:
        return broll_clips
    if not broll_clips:
        return product_clips

    total_slots = max(2, int(round(max(audio_duration, 3.0) / 3.0)))
    timeline = []
    p0_idx = 0
    broll_idx = 0

    for slot in range(total_slots):
        is_hook = (slot == 0)
        is_cta = (slot == total_slots - 1 and total_slots >= 3)
        current_p0_ratio = (p0_idx + 1) / (slot + 1)

        if is_hook or is_cta or current_p0_ratio <= p0_ratio:
            timeline.append(product_clips[p0_idx % len(product_clips)])
            p0_idx += 1
        else:
            timeline.append(broll_clips[broll_idx % len(broll_clips)])
            broll_idx += 1

    return timeline


def get_video_materials(task_id, params, video_terms, audio_duration):
    p0_ratio, p1_ratio, p2_ratio = (
        params.get_normalized_visual_ratios()
        if hasattr(params, "get_normalized_visual_ratios")
        else (0.7, 0.3, 0.0)
    )

    product_clips = []
    product_data = getattr(params, "product_data", None)
    if isinstance(product_data, dict) and (product_data.get("images") or product_data.get("videos")):
        logger.info("\n\n## processing product visuals (images & videos) for affiliate video")
        target_p0_duration = audio_duration * p0_ratio
        try:
            product_clips = material.process_product_visuals(
                task_id=task_id,
                images=product_data.get("images", []),
                videos=product_data.get("videos", []),
                video_aspect=params.video_aspect,
                target_p0_duration=target_p0_duration,
            )
        except Exception as e:
            logger.error(f"Error processing product visuals for task {task_id}: {e}", exc_info=True)
            product_clips = []

    if params.video_source == "local":
        logger.info("\n\n## preprocess local materials")
        materials = video.preprocess_video(
            materials=params.video_materials, clip_duration=params.video_clip_duration
        )
        if not materials and not product_clips:
            sm.state.update_task(task_id, state=const.TASK_STATE_FAILED)
            logger.error(
                "no valid materials found, please check the materials and try again."
            )
            return None
        local_paths = [material_info.url for material_info in materials] if materials else []
        if product_clips and local_paths:
            return compose_visual_timeline(
                product_clips=product_clips,
                broll_clips=local_paths,
                audio_duration=audio_duration,
                p0_ratio=p0_ratio,
            )
        return product_clips or local_paths
    else:
        logger.info(f"\n\n## downloading videos from {params.video_source}")
        # B-roll target duration bounded by supporting ratio if product clips exist
        target_broll_duration = (
            audio_duration * (p1_ratio + p2_ratio)
            if product_clips
            else audio_duration
        )

        downloaded_videos = material.download_videos(
            task_id=task_id,
            search_terms=video_terms,
            source=params.video_source,
            video_aspect=params.video_aspect,
            video_concat_mode=(
                VideoConcatMode.sequential
                if params.match_materials_to_script
                else params.video_concat_mode
            ),
            audio_duration=target_broll_duration * params.video_count,
            max_clip_duration=params.video_clip_duration,
            match_script_order=params.match_materials_to_script,
        )

        if not downloaded_videos and not product_clips:
            # Fallback: try search B-roll using video_terms or subject
            logger.warning("Product visuals download empty, attempting fallback B-roll search...")
            search_terms = video_terms if video_terms else [params.video_subject or "product"]
            downloaded_videos = material.download_videos(
                task_id=task_id,
                search_terms=search_terms,
                source=params.video_source if params.video_source != "local" else "pexels",
                video_aspect=params.video_aspect,
                audio_duration=audio_duration * params.video_count,
                max_clip_duration=params.video_clip_duration,
            )

        if not downloaded_videos and not product_clips:
            sm.state.update_task(
                task_id,
                state=const.TASK_STATE_FAILED,
                error_msg="Không tải được tư liệu video/ảnh (Shopee 404 / Không tìm thấy tư liệu)",
                error_step="materials",
            )
            logger.error(
                "failed to download videos or product materials."
            )
            return None

        if product_clips and downloaded_videos:
            return compose_visual_timeline(
                product_clips=product_clips,
                broll_clips=downloaded_videos,
                audio_duration=audio_duration,
                p0_ratio=p0_ratio,
            )
        elif product_clips:
            return product_clips

        return downloaded_videos


def generate_final_videos(
    task_id, params, downloaded_videos, audio_file, subtitle_path
):
    final_video_paths = []
    combined_video_paths = []
    # 多视频生成默认会打散素材以增加差异；但“按文案顺序匹配素材”追求的是
    # 时间线稳定性和可解释性，所以开启后所有输出都使用顺序拼接。
    if params.match_materials_to_script:
        video_concat_mode = VideoConcatMode.sequential
    elif params.video_count == 1:
        video_concat_mode = params.video_concat_mode
    else:
        video_concat_mode = VideoConcatMode.random
    video_transition_mode = params.video_transition_mode

    _progress = 50
    for i in range(params.video_count):
        index = i + 1
        combined_video_path = path.join(
            utils.task_dir(task_id), f"combined-{index}.mp4"
        )
        logger.info(f"\n\n## combining video: {index} => {combined_video_path}")
        video.combine_videos(
            combined_video_path=combined_video_path,
            video_paths=downloaded_videos,
            audio_file=audio_file,
            video_aspect=params.video_aspect,
            video_concat_mode=video_concat_mode,
            video_transition_mode=video_transition_mode,
            max_clip_duration=params.video_clip_duration,
            threads=params.n_threads,
        )

        _progress += 50 / params.video_count / 2
        sm.state.update_task(task_id, progress=_progress)

        final_video_path = path.join(utils.task_dir(task_id), f"final-{index}.mp4")

        logger.info(f"\n\n## generating video: {index} => {final_video_path}")
        video.generate_video(
            video_path=combined_video_path,
            audio_path=audio_file,
            subtitle_path=subtitle_path,
            output_file=final_video_path,
            params=params,
        )

        _progress += 50 / params.video_count / 2
        sm.state.update_task(task_id, progress=_progress)

        final_video_paths.append(final_video_path)
        combined_video_paths.append(combined_video_path)

    return final_video_paths, combined_video_paths


def start(task_id, params: VideoParams, stop_at: str = "video"):
    logger.info(f"start task: {task_id}, stop_at: {stop_at}")
    sm.state.update_task(task_id, state=const.TASK_STATE_PROCESSING, progress=5)

    # 1. Generate script
    video_script = generate_script(task_id, params)
    if not video_script or "Error: " in video_script:
        sm.state.update_task(
            task_id,
            state=const.TASK_STATE_FAILED,
            error_msg="Lỗi tạo kịch bản (Generate script failed)",
            error_step="script",
        )
        return

    sm.state.update_task(task_id, state=const.TASK_STATE_PROCESSING, progress=10)

    if stop_at == "script":
        save_script_data(task_id, video_script, "", params)
        sm.state.update_task(
            task_id, state=const.TASK_STATE_COMPLETE, progress=100, script=video_script
        )
        return {"script": video_script}

    # 2. Generate terms
    video_terms = ""
    if params.video_source != "local":
        video_terms = generate_terms(task_id, params, video_script)
        if not video_terms:
            sm.state.update_task(
                task_id,
                state=const.TASK_STATE_FAILED,
                error_msg="Lỗi trích xuất từ khóa tìm kiếm (Generate search terms failed)",
                error_step="terms",
            )
            return

    save_script_data(task_id, video_script, video_terms, params)

    if stop_at == "terms":
        sm.state.update_task(
            task_id, state=const.TASK_STATE_COMPLETE, progress=100, terms=video_terms
        )
        return {"script": video_script, "terms": video_terms}

    sm.state.update_task(task_id, state=const.TASK_STATE_PROCESSING, progress=20)

    # 3. Generate audio
    audio_file, audio_duration, sub_maker = generate_audio(
        task_id, params, video_script
    )
    if not audio_file:
        sm.state.update_task(
            task_id,
            state=const.TASK_STATE_FAILED,
            error_msg="Lỗi tạo giọng đọc TTS / Audio (Audio generation failed)",
            error_step="audio",
        )
        return

    sm.state.update_task(task_id, state=const.TASK_STATE_PROCESSING, progress=30)

    if stop_at == "audio":
        sm.state.update_task(
            task_id,
            state=const.TASK_STATE_COMPLETE,
            progress=100,
            audio_file=audio_file,
        )
        return {"audio_file": audio_file, "audio_duration": audio_duration}

    # 4. Generate subtitle
    subtitle_path = generate_subtitle(
        task_id, params, video_script, sub_maker, audio_file
    )

    if stop_at == "subtitle":
        sm.state.update_task(
            task_id,
            state=const.TASK_STATE_COMPLETE,
            progress=100,
            subtitle_path=subtitle_path,
        )
        return {"subtitle_path": subtitle_path}

    sm.state.update_task(task_id, state=const.TASK_STATE_PROCESSING, progress=40)

    # 5. Get video materials
    downloaded_videos = get_video_materials(
        task_id, params, video_terms, audio_duration
    )
    if not downloaded_videos:
        sm.state.update_task(
            task_id,
            state=const.TASK_STATE_FAILED,
            error_msg="Lỗi tải tư liệu video/ảnh (Get materials failed)",
            error_step="materials",
        )
        return

    if stop_at == "materials":
        sm.state.update_task(
            task_id,
            state=const.TASK_STATE_COMPLETE,
            progress=100,
            materials=downloaded_videos,
        )
        return {"materials": downloaded_videos}

    sm.state.update_task(task_id, state=const.TASK_STATE_PROCESSING, progress=50)

    # 仅完整视频生成流程才需要处理视频拼接模式；
    # 这样可以避免 /subtitle 和 /audio 这类请求访问不存在的字段。
    if type(params.video_concat_mode) is str:
        params.video_concat_mode = VideoConcatMode(params.video_concat_mode)

    # 6. Generate final videos
    final_video_paths, combined_video_paths = generate_final_videos(
        task_id, params, downloaded_videos, audio_file, subtitle_path
    )

    if not final_video_paths:
        sm.state.update_task(
            task_id,
            state=const.TASK_STATE_FAILED,
            error_msg="Lỗi ghép nối và render video hoàn chỉnh (Render video failed)",
            error_step="rendering",
        )
        return

    logger.success(
        f"task {task_id} finished, generated {len(final_video_paths)} videos."
    )

    # 7. Cross-post to social platforms (if enabled)
    cross_post_results = []
    if upload_post.upload_post_service.is_configured() and upload_post.upload_post_service.auto_upload:
        platforms = upload_post.upload_post_service.platforms
        logger.info(f"\n\n## cross-posting videos to {', '.join(platforms)}")

        youtube_extra = None
        if any(p.startswith("youtube") for p in platforms):
            metadata = llm.generate_social_metadata(
                video_subject=params.video_subject,
                video_script=video_script,
                language=params.video_language or "",
                platform="youtube_shorts",
            )
            youtube_extra = {
                "youtube_title": metadata.get("title", params.video_subject),
                "youtube_description": metadata.get("caption", ""),
                "tags": metadata.get("hashtags", []),
                "privacyStatus": upload_post.upload_post_service.youtube_privacy_status,
                "containsSyntheticMedia": True,
            }

        for video_path in final_video_paths:
            result = upload_post.cross_post_video(
                video_path=video_path,
                title=params.video_subject or "Check out this video! #shorts #viral",
                youtube_extra=youtube_extra,
            )
            cross_post_results.append(result)
            if result.get('success'):
                logger.info(f"✅ Cross-posted: {video_path}")
            else:
                logger.warning(f"⚠️ Failed to cross-post: {video_path} - {result.get('error', 'Unknown error')}")

    kwargs = {
        "videos": final_video_paths,
        "combined_videos": combined_video_paths,
        "script": video_script,
        "terms": video_terms,
        "audio_file": audio_file,
        "audio_duration": audio_duration,
        "subtitle_path": subtitle_path,
        "materials": downloaded_videos,
        "cross_post_results": cross_post_results if cross_post_results else None,
    }
    sm.state.update_task(
        task_id, state=const.TASK_STATE_COMPLETE, progress=100, **kwargs
    )
    return kwargs


if __name__ == "__main__":
    task_id = "task_id"
    params = VideoParams(
        video_subject="金钱的作用",
        voice_name="zh-CN-XiaoyiNeural-Female",
        voice_rate=1.0,
    )
    start(task_id, params, stop_at="video")

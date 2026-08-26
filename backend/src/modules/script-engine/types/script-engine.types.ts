export type MediaType =
  | 'product_image'
  | 'product_video'
  | 'stock_video'
  | 'stock_image'
  | 'ai_image'
  | 'text_only';

export interface ScriptScene {
  sceneNumber: number;
  startTime: number;
  endTime: number;
  duration: number;
  narration: string;
  onScreenText: string;
  visualDirection: string;
  mediaType: MediaType;
}

export interface VideoScriptResponse {
  id: string;
  productId: string;
  contentIdeaId?: string | null;
  title: string;
  duration: number;
  language: string;
  hook: string;
  scenes: ScriptScene[];
  cta: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RawScriptLlmOutput {
  title?: string;
  duration?: number;
  hook?: string;
  scenes?: Array<{
    sceneNumber?: number;
    startTime?: number;
    endTime?: number;
    duration?: number;
    narration?: string;
    onScreenText?: string;
    visualDirection?: string;
    mediaType?: string;
  }>;
  cta?: string;
}

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PublishingDashboard from "../PublishingDashboard";
import api from "@/lib/api";

jest.mock("@/lib/api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

describe("PublishingDashboard", () => {
  const mockAccounts = [
    {
      id: "acc-1",
      platform: "TIKTOK",
      accountName: "My TikTok",
      status: "ACTIVE",
      hasAccessToken: true,
      hasRefreshToken: true,
      isConfigured: true,
    },
  ];

  const mockVideos = [
    {
      id: "vid-1",
      title: "Test Short Video 1",
      videoObjectKey: "videos/vid1.mp4",
      createdAt: new Date().toISOString(),
    },
  ];

  const mockJobs = [];

  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === "/publishing/accounts") return Promise.resolve({ data: mockAccounts });
      if (url === "/videos") return Promise.resolve({ data: mockVideos });
      if (url === "/publishing/jobs") return Promise.resolve({ data: mockJobs });
      return Promise.resolve({ data: [] });
    });
  });

  it("renders PublishingDashboard and loads accounts & videos", async () => {
    render(<PublishingDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Multi-Platform Video Publishing")).toBeInTheDocument();
      expect(screen.getByText("My TikTok")).toBeInTheDocument();
    });
  });

  it("switches to Upload File tab when clicked", async () => {
    render(<PublishingDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Select Video")).toBeInTheDocument();
    });

    const uploadTabBtn = screen.getByText("Upload File");
    fireEvent.click(uploadTabBtn);

    expect(screen.getByText(/Click to select or drop video file here/i)).toBeInTheDocument();
  });

  it("handles direct video file upload successfully", async () => {
    const newUploadedVideo = {
      id: "vid-uploaded-1",
      title: "my-uploaded-file",
      videoObjectKey: "uploads/videos/test.mp4",
      createdAt: new Date().toISOString(),
    };

    (api.post as jest.Mock).mockResolvedValueOnce({ data: newUploadedVideo });

    render(<PublishingDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Upload File")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Upload File"));

    const file = new File(["fake-video-content"], "my-uploaded-file.mp4", { type: "video/mp4" });
    const fileInput = document.querySelector("#video-file-input") as HTMLInputElement;

    expect(fileInput).toBeInTheDocument();

    Object.defineProperty(fileInput, "files", {
      value: [file],
    });

    fireEvent.change(fileInput);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        "/videos/upload",
        expect.any(FormData),
        expect.objectContaining({
          headers: { "Content-Type": "multipart/form-data" },
        })
      );
      expect(screen.getByText(/Đã tải lên video/i)).toBeInTheDocument();
    });
  });

  it("generates title, caption, and hashtags using AI button", async () => {
    (api.post as jest.Mock).mockResolvedValueOnce({
      data: {
        title: "AI Super Catchy Title",
        caption: "Awesome caption content!",
        hashtagsString: "#ai #viral #super",
      },
    });

    render(<PublishingDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Tạo Tiêu đề, Caption & Hashtags bằng AI/i)).toBeInTheDocument();
    });

    const generateBtn = screen.getByText(/Tạo Tiêu đề, Caption & Hashtags bằng AI/i);
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/publishing/generate-metadata", expect.any(Object));
      expect(screen.getByDisplayValue("AI Super Catchy Title")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Awesome caption content!")).toBeInTheDocument();
      expect(screen.getByDisplayValue("#ai #viral #super")).toBeInTheDocument();
    });
  });
});

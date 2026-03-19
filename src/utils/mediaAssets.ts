import fs from "node:fs";
import path from "node:path";

const LOCAL_VIDEO_DIR = path.resolve(process.cwd(), "video");

const MEDIA_FILE_ALIASES: Record<string, string[]> = {
  "lesson-1.mp4": ["lesson-1.mp4", "Lectia 1.mp4", "Lectia 1.mov"],
  "lesson-1-v2-landscape.mp4": ["lesson-1-v2-landscape.mp4", "lesson-1.mp4", "Lectia 1.mp4", "Lectia 1.mov"],
  "lesson-2.mp4": ["lesson-2.mp4", "Lectia 2.mp4", "Lectia 2.mov"],
  "lesson-2-v2-landscape.mp4": ["lesson-2-v2-landscape.mp4", "lesson-2.mp4", "Lectia 2.mp4", "Lectia 2.mov"],
  "lesson-3.mp4": ["lesson-3.mp4", "Lectia 3.mp4", "Lectia 3.mov"],
  "lesson-3-v2-landscape.mp4": ["lesson-3-v2-landscape.mp4", "lesson-3.mp4", "Lectia 3.mp4", "Lectia 3.mov"],
  "method.mp4": ["method.mp4", "Video_metda_depredare!.mp4"],
  "method-v2-vertical.mp4": ["method-v2-vertical.mp4", "method.mp4", "Video_metda_depredare!.mp4"],
  "academy.mp4": ["academy.mp4", "Despre academie.mp4", "Despre_academie.mp4"],
  "academy-v2-vertical.mp4": ["academy-v2-vertical.mp4", "academy.mp4", "Despre academie.mp4", "Despre_academie.mp4"],
  "webinar-fear.mp4": ["webinar-fear.mp4", "Webinar_fear_speaking.mp4"],
  "webinar-fear-v2-vertical.mp4": ["webinar-fear-v2-vertical.mp4", "webinar-fear.mp4", "Webinar_fear_speaking.mp4"],
  "Image_welcome.JPG": ["Image_welcome.JPG", "Image_welcome.jpg", "welcome.jpg", "welcome.jpeg"],
};

function getCandidateFileNames(fileName: string): string[] {
  const aliases = MEDIA_FILE_ALIASES[fileName] ?? [fileName];
  return Array.from(new Set([fileName, ...aliases]));
}

export function resolveExistingMediaFile(fileName: string): string | null {
  if (!fileName) {
    return null;
  }

  if (path.isAbsolute(fileName) && fs.existsSync(fileName) && fs.statSync(fileName).isFile()) {
    return fileName;
  }

  const projectRelative = path.resolve(process.cwd(), fileName);
  if (fs.existsSync(projectRelative) && fs.statSync(projectRelative).isFile()) {
    return projectRelative;
  }

  for (const candidate of getCandidateFileNames(fileName)) {
    const resolved = path.resolve(LOCAL_VIDEO_DIR, candidate);
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      return resolved;
    }
  }

  return null;
}

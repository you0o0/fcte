import fs from "fs";
import path from "path";
import { google } from "googleapis";

const apiKey = process.env.YOUTUBE_API_KEY;
const youtube = google.youtube({ version: "v3", auth: apiKey });

// جلب كل الفيديوهات من بلايليست (مع pagination)
async function fetchPlaylistVideos(playlistId) {
  let videos = [];
  let nextPageToken = null;

  do {
    const res = await youtube.playlistItems.list({
      playlistId,
      part: ["snippet", "contentDetails"],
      maxResults: 50,
      pageToken: nextPageToken,
    });

    const items = res.data.items || [];
    videos.push(
      ...items.map((item, index) => ({
        id: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        thumbnailUrl: item.snippet.thumbnails.high.url,
        uploadedTime: item.snippet.publishedAt.split("T")[0],
        url: `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`,
        order: videos.length + index + 1,
      }))
    );

    nextPageToken = res.data.nextPageToken;
  } while (nextPageToken);

  // لجلب مدة كل فيديو
  const videoIds = videos.map(v => v.id);
  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50);
    const details = await youtube.videos.list({
      part: ["contentDetails"],
      id: chunk.join(","),
    });

    details.data.items.forEach((video, idx) => {
      videos[i + idx].duration = video.contentDetails.duration; // ISO 8601 duration
    });
  }

  return videos;
}

// قراءة playlists.json وتحديث كل courseJson
async function updateAllCourses() {
  const data = JSON.parse(fs.readFileSync("playlists.json", "utf-8"));

  for (const category of data.categories) {
    for (const channel of category.channels) {
      for (const course of channel.courses) {
        console.log(`Updating course ${course.id}...`);
        const videos = await fetchPlaylistVideos(course.playlistId);

        const coursePath = path.join(course.courseJson);
        fs.mkdirSync(path.dirname(coursePath), { recursive: true });
        fs.writeFileSync(coursePath, JSON.stringify(videos, null, 2));
      }
    }
  }
  console.log("All courses updated successfully.");
}

updateAllCourses().catch(console.error);

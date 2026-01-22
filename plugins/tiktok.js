// plugins/tiktok.js
import axios from "axios";
import { cmd } from "../command";

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.9",
  "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
  "X-Requested-With": "XMLHttpRequest",
  Referer: "https://tikdown.com/en",
  Origin: "https://tikdown.com",
};

async function getDownloadLink(mediaUrl, originalSize) {
  try {
    const { data } = await axios.post(
      "https://tikdown.com/proxy.php",
      new URLSearchParams({ url: mediaUrl }),
      { headers }
    );

    return {
      url: data?.api?.fileUrl || mediaUrl,
      size: data?.api?.fileSize || originalSize,
    };
  } catch {
    return null;
  }
}

async function tikdown(url) {
  try {
    const { data } = await axios.post(
      "https://tikdown.com/proxy.php",
      new URLSearchParams({ url }),
      { headers }
    );

    if (!data?.api?.mediaItems) throw "No media found";

    const api = data.api;
    const items = api.mediaItems;

    const images = items.filter(v => v.type === "Image");
    const videos = items.filter(v => v.type === "Video");
    const audios = items.filter(v => v.type === "Music" || v.type === "Audio");

    let targets = [];

    if (images.length) {
      targets.push(...images, ...audios);
    } else {
      const bestVideo = videos.find(v => v.mediaQuality === "HD") || videos[0];
      if (bestVideo) targets.push(bestVideo);
      if (audios.length) targets.push(...audios);
    }

    const media = await Promise.all(
      targets.map(async item => {
        const link = await getDownloadLink(item.mediaUrl, item.mediaFileSize);
        return {
          type: item.type,
          quality: item.mediaQuality || "Original",
          format: item.mediaExtension,
          fileSize: link?.size || item.mediaFileSize,
          downloadUrl: link?.url || item.mediaUrl,
        };
      })
    );

    return {
      info: {
        title: api.description,
        created: api.createdTime,
        author: api.userInfo?.name,
        username: api.userInfo?.username,
      },
      stats: {
        views: api.mediaStats?.viewsCount,
        likes: api.mediaStats?.likesCount,
        comments: api.mediaStats?.commentsCount,
        shares: api.mediaStats?.sharesCount,
        downloads: api.mediaStats?.downloadsCount,
      },
      media: media.filter(v => v.downloadUrl),
    };
  } catch (e) {
    console.error(e);
    return null;
  }
}

// ===== CMD HANDLER =====
cmd({
  pattern: "tiktok",
  alias: ["tiktokdl", "tt"],
  desc: "Download TikTok videos or audio",
  category: "downloader",
  react: "🎀",
  filename: __filename,
  limit: 3,
  register: true,
}, async (client, mek, m, { text, usedPrefix, command }) => {
  if (!text) {
    return client.sendMessage(
      m.chat,
      `Where is the link?\n\nExample:\n${usedPrefix + command} https://vt.tiktok.com/xxxxx`,
      { quoted: m }
    );
  }

  await client.sendMessage(m.chat, { react: { text: "🎀", key: m.key } });

  try {
    const result = await tikdown(text);
    if (!result || !result.media.length) throw "No media found";

    const { info, stats, media } = result;

    let caption = `✨ *TIKTOK DOWNLOADER* ✨

📌 *Title:* ${info.title || "-"}
👤 *Author:* ${info.author || "-"} (@${info.username || "-"})
📅 *Upload:* ${info.created || "-"}

👀 *Views:* ${stats.views || 0}
❤️ *Likes:* ${stats.likes || 0}
💬 *Comments:* ${stats.comments || 0}
🔁 *Shares:* ${stats.shares || 0}
⬇️ *Downloads:* ${stats.downloads || 0}
`;

    for (let item of media) {
      if (item.type === "Image") {
        await client.sendFile(m.chat, item.downloadUrl, "tiktok.jpg", "", m);
      }
      if (item.type === "Video") {
        await client.sendFile(m.chat, item.downloadUrl, "tiktok.mp4", caption, m);
      }
      if (item.type === "Music" || item.type === "Audio") {
        await client.sendMessage(
          m.chat,
          { audio: { url: item.downloadUrl }, mimetype: "audio/mpeg", ptt: false },
          { quoted: m }
        );
      }
    }

    await client.sendMessage(m.chat, { react: { text: "✅", key: m.key } });
  } catch (e) {
    console.error(e);
    client.sendMessage(
      m.chat,
      "Failed to fetch media 😿\nMake sure the TikTok link is valid & try again.",
      { quoted: m }
    );
  }
});

export default cmd;

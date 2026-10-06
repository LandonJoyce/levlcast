import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: "https://www.levlcast.com",
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      // The no-signup analyzer. Highest-intent page on the site after the
      // homepage, and the only one a stranger can get value from without
      // an account, so it ranks alongside the landing page.
      url: "https://www.levlcast.com/analyze",
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      // The OBS panel on its own page, for links that should preview it.
      url: "https://www.levlcast.com/obs",
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: "https://www.levlcast.com/twitch-vod-analyzer",
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: "https://www.levlcast.com/twitch-clip-generator",
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: "https://www.levlcast.com/twitch-stream-coach",
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: "https://www.levlcast.com/how-to-grow-on-twitch",
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: "https://www.levlcast.com/why-no-one-watches-my-stream",
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: "https://www.levlcast.com/what-to-say-on-stream",
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: "https://www.levlcast.com/how-to-start-a-stream",
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: "https://www.levlcast.com/leaderboard",
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: "https://www.levlcast.com/terms",
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: "https://www.levlcast.com/privacy",
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}

import 'dotenv/config';
import '@/index';
import App from '@/app';
import AuthRoute from '@routes/auth.route';
import UsersRoute from './routes/users.route';
import UploadRoute from '@routes/upload.route';
import CompanyRoute from './routes/company.route';
import CouponRoute from './routes/coupon.route';
import cron from 'node-cron';
import { config } from '../src/configs/topics';
import { parseDate } from './utlis';
import prisma from './lib/prisma';
import { JSDOM } from 'jsdom';
import axios from 'axios';

const apiKey = process.env.SERPER_API_KEY;
const baseUrl = 'https://google.serper.dev/news';

const app = new App([new AuthRoute(), new UsersRoute(), new UploadRoute(), new CompanyRoute(), new CouponRoute()]);

app.listen();

interface URLMetadata {
    title: string;
    imageURL: string;
    description: string;
    date: string;
    favicon: string;
}

//cron job running every Sunday night
cron.schedule('0 0 * * SUN', async () => {
    await getNews();
});

async function getNews(): Promise<void> {
    const newsResponse: any = {};

    await Promise.all(
        config.topics.map(async (topic) => {
            const news = await fetchNewsForTopic(topic);
            newsResponse[topic] = news;
        })
    );

    const findTags = await prisma.tags.findMany({});
    const data: any[] = [];

    for (const topic of Object.keys(newsResponse)) {
        const tagEntry = findTags.find((tag) => tag.name === topic);
        if (tagEntry) {
            const tags = tagEntry.id;
            const updatedNewsResponse = [];

            for (const item of newsResponse[topic]) {
                item.tags = tags;
                const metadata = await getURLMetadata(item.link);
                item.imageUrl = metadata?.imageURL || '';
                updatedNewsResponse.push(item);
            }

            newsResponse[topic] = updatedNewsResponse;
            data.push(...newsResponse[topic]);
        }
    }

    try {
        await prisma.discover.createMany({
            data: data,
        });
        console.log('Data saved successfully');
    } catch (e) {
        console.error('Error saving data:', e);
    }
}

async function fetchNewsForTopic(topic: string): Promise<any[]> {
    try {
        const response = await axios.post(
            baseUrl,
            {
                q: `Orthopedics ${topic} news`,
                num: config.newsPerTopic,
            },
            {
                headers: {
                    'X-API-KEY': apiKey,
                    'Content-Type': 'application/json',
                },
                timeout: 10000, // Timeout in 10 seconds
            }
        );

        if (!response.data.news || !Array.isArray(response.data.news)) {
            console.warn(`No news data found for topic ${topic}`);
            return [];
        }

        return response.data.news.map((item: any) => ({
            tags: topic,
            title: item.title || 'No title available',
            link: item.link || '',
            snippet: item.snippet || 'No snippet available',
            date: parseDate(item.date),
            source: item.source || 'Unknown source',
            imageUrl: item.imageUrl || '',
        }));
    } catch (error) {
        console.error(`Error fetching news for topic ${topic}: ${error.message || error}`);
        return [];
    }
}

async function getURLMetadata(url: string): Promise<URLMetadata | null> {
    try {
        const response = await axios.get(url, { responseType: 'text', timeout: 10000 }); // Timeout in 10 seconds
        const dom = new JSDOM(response.data, { url });
        const doc = dom.window.document;

        const metadata: URLMetadata = {
            title: doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || doc.querySelector('title')?.textContent || '',
            imageURL: doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content') || '',
            description: doc.querySelector('meta[property="og:description"]')?.getAttribute('content') || doc.querySelector('meta[name="description"]')?.getAttribute('content') || '',
            date: doc.querySelector('meta[property="article:published_time"]')?.getAttribute('content') || doc.querySelector('time')?.getAttribute('datetime') || '',
            favicon: await getFaviconURL(doc, url),
        };

        return metadata;
    } catch (error) {
        console.warn(`Failed to fetch metadata for URL: ${url}, error: ${error.message || error}`);
        return null;
    }
}

async function getFaviconURL(doc: any, baseURL: string): Promise<string> {
    const selectors = [
        'link[rel="apple-touch-icon"]',
        'link[rel="icon"]',
        'link[rel="shortcut icon"]',
        'link[rel="mask-icon"]',
    ];

    for (const selector of selectors) {
        const link = doc.querySelector(selector);
        if (link?.getAttribute('href')) {
            const faviconPath = link.getAttribute('href')!;
            try {
                if (faviconPath.startsWith('http')) {
                    return faviconPath;
                } else if (faviconPath.startsWith('//')) {
                    return `https:${faviconPath}`;
                } else {
                    return new URL(faviconPath, baseURL).href;
                }
            } catch (error) {
                console.warn(`Error processing favicon path: ${faviconPath}, error: ${error}`);
                continue;
            }
        }
    }

    try {
        return new URL('/favicon.ico', baseURL).href;
    } catch (error) {
        console.warn(`Error resolving default favicon for ${baseURL}: ${error}`);
        return '';
    }
}
import dotenv from 'dotenv';
dotenv.config();

export const config = {
  serperApiKey: process.env.SERPER_API_KEY,
  topics: [
    'Top',
    'Hand',
    'Spine',
    'Shoulder',
    'Charnley',
    'Trauma',
    'Arthos',
    'Salter'
  ],
  newsPerTopic: 30
};
import node from '@sveltejs/adapter-node';
import vercel from '@sveltejs/adapter-vercel';

export default {
  kit: { adapter: process.env.VERCEL ? vercel() : node() }
};

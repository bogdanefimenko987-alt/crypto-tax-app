import app from '../src/app';

export default async (req: any, res: any) => {
  try {
    await app(req, res);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
};
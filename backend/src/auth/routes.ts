import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { users } from '../store';

const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  const user = { id: uuidv4(), email, passwordHash: hash };
  users.push(user);
  res.json({ id: user.id, email: user.email });
});

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = users.find((u: any) => u.email === email);
  if (!user || !await bcrypt.compare(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Неверные учетные данные' });
  }
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET!,
    { expiresIn: '1d' }
  );
  res.json({ token, user: { id: user.id, email: user.email } });
});

export default router;
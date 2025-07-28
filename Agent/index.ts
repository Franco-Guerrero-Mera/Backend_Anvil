import 'dotenv/config';
import express, { Express, Request, Response } from "express";
import cors from 'cors';
import { callAgent } from './agent';

const app: Express = express();
app.use(express.json());
app.use(cors());

// ✅ Basic health check
app.get('/', (req: Request, res: Response) => {
  res.send('LangGraph Chat Server is running');
});

// ✅ Chat endpoint (no username, no database)
app.post('/chat', async (req: Request, res: Response) => {
  console.log('/chat has been called');
  const { message } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required." });
  }

  const threadId = Date.now().toString(); // Can be removed if agent doesn't need it
  try {
    const response = await callAgent(message); // 👈 callAgent is now simplified
    res.json({ response });
  } catch (error) {
    console.error('Error processing chat:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

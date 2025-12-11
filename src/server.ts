import app from './app';
import dotenv from 'dotenv';
import http from 'http';
import { initSocket } from './socket';
import { initializeFirebase } from './services/notification.service';

dotenv.config();

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
initSocket(server);
initializeFirebase();

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

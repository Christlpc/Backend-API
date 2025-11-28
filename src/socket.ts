import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

let io: Server;

export const initSocket = (httpServer: HttpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: '*', // Allow all origins for now, restrict in production
            methods: ['GET', 'POST']
        }
    });

    // Middleware for authentication
    io.use((socket: Socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication error'));
        }
        try {
            const decoded = jwt.verify(token, JWT_SECRET) as any;
            socket.data.userId = decoded.userId;
            socket.data.role = decoded.role;
            next();
        } catch (err) {
            next(new Error('Authentication error'));
        }
    });

    io.on('connection', (socket: Socket) => {
        console.log(`User connected: ${socket.data.userId} (${socket.data.role})`);

        // Join a room based on userId for targeted messages
        socket.join(`user_${socket.data.userId}`);

        // If driver, join drivers room
        if (socket.data.role === 'DRIVER') {
            socket.join('drivers');
        }

        // Event: Driver updates location
        socket.on('update_location', (data: { lat: number; lng: number; rideId?: number }) => {
            // Broadcast to specific ride room if rideId provided, or just log
            if (data.rideId) {
                io.to(`ride_${data.rideId}`).emit('driver_location', data);
            }
        });

        // Event: Join ride room (for tracking)
        socket.on('join_ride', (rideId: number) => {
            socket.join(`ride_${rideId}`);
        });

        socket.on('disconnect', () => {
            console.log('User disconnected');
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized!');
    }
    return io;
};

import { Server, ServerWebSocket } from "bun";
import jwt from "jsonwebtoken";

interface WebSocketData {
    clientId: string;
    connectedAt: Date;
    subscriptions: Set<string>;
}

// Event types
const EVENTS = {
    SCHEDULE_UPDATED: "schedule_updated",
    AVAILABILITY_UPDATED: "availability_updated",
    ABSENCE_UPDATED: "absence_updated",
    SETTINGS_UPDATED: "settings_updated",
    COVERAGE_UPDATED: "coverage_updated",
    SHIFT_TEMPLATE_UPDATED: "shift_template_updated",
} as const;

const server = Bun.serve<WebSocketData>({
    port: 5001,
    fetch(req, server) {
        // Handle WebSocket upgrade
        const url = new URL(req.url);
        const token = url.searchParams.get("token") ||
            req.headers.get("Authorization")?.replace("Bearer ", "");

        if (!token) {
            return new Response("No token provided", { status: 401 });
        }

        try {
            // Verify JWT token
            const payload = jwt.verify(token, process.env.JWT_SECRET_KEY!) as jwt.JwtPayload;
            const clientId = payload.sub;

            if (!clientId) {
                return new Response("Invalid token", { status: 401 });
            }

            // Upgrade the connection with client data
            const success = server.upgrade(req, {
                data: {
                    clientId,
                    connectedAt: new Date(),
                    subscriptions: new Set(),
                },
                headers: {
                    "Sec-WebSocket-Protocol": "schichtplan-v1",
                },
            });

            return success
                ? undefined
                : new Response("WebSocket upgrade failed", { status: 500 });
        } catch (error) {
            console.error("Token verification failed:", error);
            return new Response("Invalid token", { status: 401 });
        }
    },

    websocket: {
        // Enable compression for better performance
        perMessageDeflate: true,

        // Set reasonable limits
        maxPayloadLength: 16 * 1024 * 1024, // 16MB
        idleTimeout: 120, // 2 minutes

        open(ws) {
            console.log(`Client ${ws.data.clientId} connected`);
            ws.send(JSON.stringify({
                type: "connection_established",
                data: {
                    client_id: ws.data.clientId,
                    is_authenticated: true,
                    user_id: ws.data.clientId,
                },
            }));
        },

        message(ws, message) {
            try {
                const data = JSON.parse(message.toString());

                switch (data.type) {
                    case "subscribe":
                        if (data.event && typeof data.event === "string") {
                            ws.data.subscriptions.add(data.event);
                            ws.subscribe(data.event);
                            ws.send(JSON.stringify({
                                type: "subscribe_response",
                                status: "success",
                                message: `Subscribed to ${data.event}`,
                            }));
                        }
                        break;

                    case "unsubscribe":
                        if (data.event && typeof data.event === "string") {
                            ws.data.subscriptions.delete(data.event);
                            ws.unsubscribe(data.event);
                            ws.send(JSON.stringify({
                                type: "unsubscribe_response",
                                status: "success",
                                message: `Unsubscribed from ${data.event}`,
                            }));
                        }
                        break;

                    case "ping":
                        ws.send(JSON.stringify({ type: "pong" }));
                        break;

                    default:
                        console.warn(`Unknown message type: ${data.type}`);
                }
            } catch (error) {
                console.error("Error handling message:", error);
                ws.send(JSON.stringify({
                    type: "error",
                    message: "Invalid message format",
                }));
            }
        },

        close(ws, code, message) {
            console.log(`Client ${ws.data.clientId} disconnected:`, { code, message });
            // Clean up subscriptions
            ws.data.subscriptions.forEach(topic => ws.unsubscribe(topic));
        },

        drain(ws) {
            console.log(`Ready to receive more data from client ${ws.data.clientId}`);
        },
    },
});

console.log(`WebSocket server listening on port ${server.port}`);

// Export broadcast function for use in other parts of the application
export function broadcastEvent(eventType: keyof typeof EVENTS, data: any) {
    server.publish(eventType, JSON.stringify({
        type: eventType,
        data,
    }));
}

export { server, EVENTS }; 
export interface IClientMessage {
    type: string;
    payload: any;
    timestamp: number;
}

export interface IServerMessage {
    type: 'subscriber' | 'unsubscribe' | 'message' | 'publisher';
    topic?: string;
    isNewStock?: boolean;
    payload: {
        stock: string;
        price?: number;
    };
}

export interface IResponseMessage {
    payload: {
        stock: string,
        price?: number
    };
    message: string;
    timestamp: number;
}

export interface IWebSocketConnection {
    id: string;
    socket: WebSocket;
    timestamp: number;
}

export interface IConnectionRegistry {
    connections: Map<string, IWebSocketConnection>;
    add(connection: IWebSocketConnection): void;
    remove(id: string): void;
    broadcast(message: IServerMessage): void;
} 
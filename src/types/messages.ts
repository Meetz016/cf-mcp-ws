export interface IClientMessage {
    type: string;
    payload: any;
    timestamp: number;
}

export interface IServerMessage {
    type: 'subscriber' | 'unsubscribe' | 'publisher' | 'stock-update';
    topic?: string;
    id?: string;
    isNewStock?: boolean;
    payload: {
        stock: string;
        price?: string;
    };
}

export interface IResponseMessage {
    type?: 'stock-update'
    payload: {
        stock: string,
        price?: string
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
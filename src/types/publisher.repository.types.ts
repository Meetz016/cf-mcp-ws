export interface IPublisherRepository {
    publisher_id: string;
    stock_name: string,
    stock_symbol: string,
    stock_price: string
}


export interface IPublisherUpdateStockPrice {
    publisher_id: string;
    stock_name: string,
    stock_symbol: string,
    stock_price: number,
}


import { createClient } from "redis";
import { WebSocket , WebSocketServer } from "ws";


//The url points to redis instance running the same docker network 
const redis=createClient({url:"redis://redis_service:6379"});

//starting websocket on port8080
const websocket=new WebSocketServer({port:8080});

//Key is webscoket connection's and value is the price of BTc , ETh  , SOl and all , halp to get which client want which price
const client=new Map<WebSocket,Set<string>>();

//The number of   coins we will publish for now  , in real app this come from data base
export const Channels = ["SOL", "ETH", "BTC"];


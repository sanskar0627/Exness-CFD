FROM oven/bun:latest

WORKDIR /home

RUN bun install -g serve

COPY package.json bun.lock ./
RUN bun install

COPY . .
    
ENV VITE_API_URL=https://backend.exness.elevenai.xyz/api/v1
ENV VITE_WEBSOCKET_URL=wss://ws.exness.elevenai.xyz

RUN bun run build

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]

## Multi-stage Dockerfile: build the Vite app, serve with nginx
FROM node:18-alpine AS build
WORKDIR /app
ENV PATH /app/node_modules/.bin:$PATH
COPY package*.json ./
RUN npm ci --silent
COPY . .
RUN npm run build

FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Optional: copy a simple nginx config if you need SPA fallback. Default nginx will work for static files.
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

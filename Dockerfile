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
## Ensure nginx listens on the port Cloud Run expects (PORT, typically 8080).
# Cloud Run provides PORT via env; default to 8080 here so the container will bind to the right port.
ENV PORT=8080

# Copy the SPA-friendly nginx config (listens on 8080)
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]

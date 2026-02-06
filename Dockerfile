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

# Update the default nginx config to listen on $PORT instead of 80. This replaces the listen directive
# in the default config file provided by the nginx image on Alpine.
## Overwrite default nginx config with a small SPA-friendly server that listens on the expected PORT.
RUN cat > /etc/nginx/conf.d/default.conf <<'NGINX_CONF'
server {
	listen 8080;
	server_name _;
	root /usr/share/nginx/html;

	# Serve static files, fallback to index.html for SPA routing
	location / {
		try_files $uri $uri/ /index.html;
	}

	# Optional: increase timeouts if you expect longer requests
	client_max_body_size 10M;
}
NGINX_CONF

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]

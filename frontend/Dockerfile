FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Serve D&IT logo as static asset at /logo.jpg
COPY logo.jpg /usr/share/nginx/html/logo.jpg
EXPOSE 80
CMD ["nginx","-g","daemon off;"]

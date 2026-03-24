# Static site for Google Cloud Run (listens on $PORT — set to 8080 in nginx config)
FROM nginx:1.25-alpine

COPY docker/nginx-cloudrun.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/
COPY css /usr/share/nginx/html/css/
COPY js /usr/share/nginx/html/js/
COPY assets /usr/share/nginx/html/assets/

EXPOSE 8080

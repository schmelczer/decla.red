FROM error-pages as build-error-pages

RUN python build.py 403 404 50x


FROM node:latest as build-webpage
WORKDIR /home/node

COPY src src
COPY static static
COPY package.json custom.d.ts tsconfig.json webpack.config.js ./

RUN npm install
RUN npm run build


FROM nginx:alpine

WORKDIR /usr/share/nginx/html

RUN rm -rf *
COPY --from=build-webpage /home/node/dist .
COPY --from=build-error-pages /home/python/built errors
RUN find . -type f | xargs gzip -k9     &&\
    chmod -R 555 .

COPY nginx-config /etc/nginx/

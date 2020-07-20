FROM schmelczera/declared-error-pages as build-error-pages

RUN python build.py 502


FROM nginx:alpine

WORKDIR /usr/share/nginx/html

RUN rm -rf *

COPY --from=build-error-pages /home/python/built errors
RUN find . -type f | xargs gzip -k9     &&\
  chmod -R 555 .

COPY nginx-config /etc/nginx/

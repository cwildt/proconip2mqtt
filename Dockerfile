FROM node:latest
WORKDIR /proconip2mqtt/
ADD index.js /proconip2mqtt/
COPY /config /proconip2mqtt/config
RUN npm i procon-ip
RUN npm i mqtt
ENTRYPOINT ["node", "./index.js"]
STOPSIGNAL SIGINT
FROM node:latest
#LABEL com.centurylinklabs.watchtower.enable="false"
WORKDIR /proconip2mqtt/
ADD index.js /proconip2mqtt/
COPY /config /proconip2mqtt/config
RUN npm i procon-ip
RUN npm i mqtt
ENTRYPOINT ["node", "./index.js"]
STOPSIGNAL SIGINT

#cd /volume1/docker/theia/proconip2mqtt/
#sudo docker build -t proconip2mqtt .
FROM node

COPY package*.json ./
COPY *.js ./

RUN npm install

ENTRYPOINT ["node", "check.js"]
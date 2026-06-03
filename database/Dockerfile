FROM public.ecr.aws/docker/library/node:18-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY seed-data.js ./

CMD ["node", "seed-data.js"]

# build js files	
FROM node:22 as build	

WORKDIR /app

COPY package.json ./
COPY package-lock.json ./

RUN npm install

COPY . .	

RUN npm run build

# build the production image
FROM node:22 as production

WORKDIR /app

COPY package.json ./
COPY package-lock.json ./

RUN npm ci --only=production

COPY --from=build /app/dist ./dist


ENTRYPOINT ["npm", "run", "start"]


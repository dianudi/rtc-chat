FROM node:22-alpine
WORKDIR /app
COPY . .

RUN yarn --production --frozen-lockfile && yarn cache clean
ENV NODE_ENV=production

EXPOSE 3000
CMD ["node", "index.js"]

HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 CMD [ "wget", "-q", "--spider", "http://localhost:3000" ]
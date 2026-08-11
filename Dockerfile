FROM node:22-slim

ARG FUNCTIOUS_REPO=https://github.com/forgetfulskybro/Fluxer-Functious.git
ARG FUNCTIOUS_REF=5672a5bc7dc361df8e85b01e0aca515da821099d

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    fontconfig \
    fonts-dejavu \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

RUN fc-cache -fv

RUN git clone "$FUNCTIOUS_REPO" /app \
    && cd /app \
    && git checkout "$FUNCTIOUS_REF"

COPY . /obw

RUN mkdir -p /app/commands /app/functions /app/reactionHandlers /app/blueprints \
    && cp /obw/commands/community.js /app/commands/community.js \
    && cp /obw/commands/provision.js /app/commands/provision.js \
    && cp /obw/functions/community.js /app/functions/community.js \
    && cp /obw/functions/communityDm.js /app/functions/communityDm.js \
    && cp /obw/reactionHandlers/community.js /app/reactionHandlers/community.js \
    && cp /obw/blueprints/server.js /app/blueprints/server.js \
    && node /obw/scripts/apply-obw.js /app

WORKDIR /app
RUN npm install

ENV API_PORT=8889
EXPOSE 8889

CMD ["node", "index.js"]

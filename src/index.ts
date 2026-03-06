import  GuildClient  from '@citadel-guilds/sdk';

const guild = new GuildClient({
  name: 'creator',
  natsPrefix: 'citadel.creator',
  port: 8000,
});

guild.start();

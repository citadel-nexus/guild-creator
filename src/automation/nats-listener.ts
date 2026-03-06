import  connect, StringCodec  from 'nats';

const sc = StringCodec();

export async function startListener() {
  const nc = await connect( servers: process.env.NATS_URL );
  const sub = nc.subscribe('citadel.creator.>');
  console.log(`[creator] Listening on citadel.creator.*`);
  for await (const msg of sub) {
    const data = sc.decode(msg.data);
    console.log(`[creator] $msg.subject: $data`);
    // Route to handlers based on msg.subject
  }
}

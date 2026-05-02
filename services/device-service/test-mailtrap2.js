const { MailtrapClient } = require("mailtrap");

const TOKEN = "afd11f2d9d7359cbbf67ff6676217ccb";

const client = new MailtrapClient({
  token: TOKEN,
});

const sender = {
  email: "hello@demomailtrap.co",
  name: "Mailtrap Test",
};
const recipients = [
  {
    email: "randomuser@example.com",
  }
];

client
  .send({
    from: sender,
    to: recipients,
    subject: "You are awesome!",
    text: "Congrats for sending test email with Mailtrap!",
    category: "Integration Test",
  })
  .then(console.log)
  .catch(e => console.error("Error is:", e.message));

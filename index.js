const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  ChannelType
} = require("discord.js");

const { createCanvas, loadImage } = require("canvas");
const moment = require("moment");

const CATEGORY_ID = "1465965687565455474";
const STAFF_ROLE_ID = "1463087905156366336";
const CLAIM_CHANNEL_ID = "1475207708910161991";
const TRANSCRIPT_CHANNEL_ID = "1476273815502983189";
const IMAGE_URL = "https://tenor.com/view/hatsune-miku-miku-ew-what-disgusted-gif-15627475628353335525";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);

  client.user.setPresence({
    activities: [{
      name: " ",
      type: 1,
      url: "https://www.twitch.tv/discord"
    }],
    status: "dnd"
  });
});

// 🎨 دالة الترانسكريبت صورة
async function generateTranscriptImage(messages) {
  const width = 900;
  const lineHeight = 70;
  const height = messages.length * lineHeight + 60;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#313338";
  ctx.fillRect(0, 0, width, height);

  let y = 40;

  for (const msg of messages) {
    const avatarURL = msg.author.displayAvatarURL({ extension: "png" });

    let avatar;
    try {
      avatar = await loadImage(avatarURL);
    } catch {
      avatar = null;
    }

    if (avatar) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(40, y, 25, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, 15, y - 25, 50, 50);
      ctx.restore();
    }

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px Arial";
    ctx.fillText(msg.author.tag, 80, y - 10);

    ctx.fillStyle = "#b5bac1";
    ctx.font = "14px Arial";
    const time = moment(msg.createdAt).format("HH:mm");
    ctx.fillText(time, 80 + ctx.measureText(msg.author.tag).width + 10, y - 10);

    ctx.fillStyle = "#dbdee1";
    ctx.font = "16px Arial";

    let content = msg.content || "";

    if (msg.attachments.size > 0) {
      msg.attachments.forEach(att => {
        content += ` ${att.url}`;
      });
    }

    ctx.fillText(content, 80, y + 15);

    y += lineHeight;
  }

  return canvas.toBuffer();
}

// ارسال القائمة
client.on("messageCreate", async (message) => {
  if (message.content === "!ticket") {

    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket_select")
      .setPlaceholder("اختر السبب")
      .addOptions([
        { label: "استفسار", value: "استفسار" },
        { label: "مشكلة", value: "مشكلة" },
        { label: "اقتراح", value: "اقتراح" },
        { label: "شكوى", value: "شكوى" }
      ]);

    const row = new ActionRowBuilder().addComponents(menu);

    await message.channel.send({
      content: IMAGE_URL,
      components: [row]
    });
  }
});

// التفاعلات
client.on("interactionCreate", async (interaction) => {

  if (interaction.isStringSelectMenu() && interaction.customId === "ticket_select") {

    await interaction.deferReply({ ephemeral: true });

    const reason = interaction.values[0];

    const channel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.id}`,
      type: ChannelType.GuildText,
      parent: CATEGORY_ID,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }
      ]
    });

    const claimChannel = interaction.guild.channels.cache.get(CLAIM_CHANNEL_ID);

    const claimRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`claim_${channel.id}_${interaction.user.id}_${reason}`)
        .setLabel("استلام التكت")
        .setStyle(ButtonStyle.Secondary)
    );

    await claimChannel.send({
      content: ` @here new ticket\nالعضو: ${interaction.user}\nالسبب: ${reason}\nالمستلم: لم يتم الاستلام بعد`,
      components: [claimRow]
    });

    await interaction.editReply({ content: "تم إنشاء التكت" });
  }

  if (interaction.isButton() && interaction.customId.startsWith("claim_")) {

    await interaction.deferReply({ ephemeral: true });

    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID))
      return interaction.editReply({ content: "للإدارة فقط" });

    const [_, channelId, userId, reason] = interaction.customId.split("_");
    const ticketChannel = interaction.guild.channels.cache.get(channelId);
    const ticketUser = await interaction.guild.members.fetch(userId);

    if (!ticketChannel)
      return interaction.editReply({ content: "التذكرة غير موجودة" });

    await ticketChannel.permissionOverwrites.edit(ticketUser.id, {
      ViewChannel: true,
      SendMessages: true
    });

    await ticketChannel.permissionOverwrites.edit(interaction.user.id, {
      ViewChannel: true,
      SendMessages: true
    });

    const updatedContent = interaction.message.content.replace(
      "لم يتم الاستلام بعد",
      `${interaction.user}`
    );

    const disabledRow = new ActionRowBuilder().addComponents(
      ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true)
    );

    await interaction.message.edit({ content: updatedContent, components: [disabledRow] });

    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("close_ticket")
        .setLabel("اغلاق التكت")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("delete_ticket")
        .setLabel("حذف التكت")
        .setStyle(ButtonStyle.Secondary)
    );

    await ticketChannel.send({
      content: `${ticketUser} ${interaction.user}\nالسبب: ${reason}`,
      components: [actionRow]
    });

    await interaction.editReply({ content: "تم استلام التكت" });
  }

  if (interaction.isButton() && interaction.customId === "close_ticket") {

    await interaction.deferReply({ ephemeral: true });

    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID))
      return interaction.editReply({ content: "للإدارة فقط" });

    await interaction.channel.send("🔒 تم إغلاق التكت");
    await interaction.editReply({ content: "تم إغلاق التكت" });
  }

  if (interaction.isButton() && interaction.customId === "delete_ticket") {

    await interaction.deferReply({ ephemeral: true });

    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID))
      return interaction.editReply({ content: "للإدارة فقط" });

    const channel = interaction.channel;

    let messages = [];
    let lastId;

    while (true) {
      const fetched = await channel.messages.fetch({ limit: 100, before: lastId });
      if (fetched.size === 0) break;

      messages.push(...fetched.values());
      lastId = fetched.last().id;
    }

    messages = messages.reverse();

    // ⭐ ترانسكريبت صورة
    const buffer = await generateTranscriptImage(messages);

    const transcriptChannel = interaction.guild.channels.cache.get(TRANSCRIPT_CHANNEL_ID);

    if (transcriptChannel) {
      await transcriptChannel.send({
        content: `📄 ${channel.name}`,
        files: [
          {
            attachment: buffer,
            name: `${channel.name}.png`
          }
        ]
      });
    }

    await interaction.editReply({ content: " سيتم حذف التكت..." });

    setTimeout(() => {
      channel.delete().catch(() => {});
    }, 3000);
  }

});

client.login(process.env.TOKEN);

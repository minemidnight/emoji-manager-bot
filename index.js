global.Promise = require("bluebird");
const superagent = require("superagent");
const Eris = require("eris-additions")(require("eris"), {
	enabled: [
		"Channel.awaitMessages",
		"Member.bannable",
		"Member.kickable",
		"Member.punishable",
		"Role.addable"
	]
});

const settings = {
	server: "296819780654989312",
	artist: "318021790184243202",
	admin: "297071826331500544",
	vote: "322957860122263572",
	suggest: "322957824785383425",
	data: "322960735397216257",
	changes: "322971161241845760"
};

async function init() {
	if(!process.env.TOKEN || !process.env.USER_TOKEN) {
		console.error("Both TOKEN and USER_TOKEN must be set as environment variables");
		process.exit(0);
	} else {
		global.bot = new Eris(process.env.TOKEN, {
			disableEvents: {
				PRESENCE_UPDATE: true,
				TYPING_START: true,
				USER_UPDATE: true,
				VOICE_STATE_UPDATE: true
			},
			messageLimit: 0,
			defaultImageFormat: "png",
			defaultImageSize: 256
		});

		global.userbot = new Eris(process.env.USER_TOKEN, {
			disableEvents: {
				CHANNEL_CREATE: true,
				CHANNEL_DELETE: true,
				CHANNEL_UPDATE: true,
				GUILD_BAN_ADD: true,
				GUILD_BAN_REMOVE: true,
				GUILD_CREATE: true,
				GUILD_DELETE: true,
				GUILD_MEMBER_ADD: true,
				GUILD_MEMBER_REMOVE: true,
				GUILD_MEMBER_UPDATE: true,
				GUILD_ROLE_CREATE: true,
				GUILD_ROLE_DELETE: true,
				GUILD_ROLE_UPDATE: true,
				GUILD_UPDATE: true,
				MESSAGE_CREATE: true,
				MESSAGE_DELETE: true,
				MESSAGE_DELETE_BULK: true,
				MESSAGE_UPDATE: true,
				PRESENCE_UPDATE: true,
				TYPING_START: true,
				USER_UPDATE: true,
				VOICE_STATE_UPDATE: true
			},
			messageLimit: 0,
			defaultImageFormat: "png",
			defaultImageSize: 256
		});
	}

	bot.once("ready", () => {
		console.log("Bot Started");
		bot.editStatus("online", { name: "with thinking things" });
	});
	bot.connect();
}
init();

async function addData(json) {
	return JSON.parse((await bot.createMessage(settings.data, JSON.stringify(json))).content);
}

async function updateData(id, updated) {
	let msgs = await bot.getMessages(settings.data, 100);
	let toEdit = msgs.find(msg => JSON.parse(msg.content).id === id);
	return JSON.parse((await toEdit.edit(JSON.stringify(updated))).content);
}

async function getData(id) {
	let msgs = await bot.getMessages(settings.data, 100);
	return msgs.map(msg => JSON.parse(msg.content)).find(data => data.id === id);
}

async function deleteData(id) {
	let msgs = await bot.getMessages(settings.data, 100);
	return await Promise.all(msgs.filter(msg => JSON.parse(msg.content).id === id).map(msg => msg.delete()));
}

bot.on("messageCreate", async message => {
	if(!message.channel.guild || message.channel.guild.id !== settings.server) return;
	else if(message.author.id === bot.user.id) return;

	if(message.channel.id === settings.suggest) {
		let attach = message.attachments[0];
		if(!attach || !attach.height || !attach.width) {
			await message.delete();
			return;
		}

		let image = (await superagent.get(attach.url)).body;

		let emoji = await userbot.createGuildEmoji(settings.server, {
			name: attach.filename.substring(0, attach.filename.lastIndexOf(".")),
			image: `data:image/png;base64,${image.toString("base64")}`
		});
		let msg = await message.channel.createMessage(`**EMOJI SUGGESTION**\n` +
				`Creator: ${message.author.mention}\n` +
				`<:${emoji.name}:${emoji.id}>`);

		await message.delete();
		await addData({ id: msg.id, emojiID: emoji.id, name: emoji.name, user: message.author.id, type: "approval" });
	} else if(message.channel.id === settings.vote) {
		await message.delete();
		let emoji = message.content.match(/<:[A-Z0-9_]{2,32}:(\d{14,20})>/i);
		if(!emoji) return;

		let msg = await message.channel.createMessage(emoji[0]);
		await msg.addReaction("✅");
		await msg.addReaction("❌");
		await addData({ id: msg.id, emojiID: emoji[1], type: "vote", manual: true });
	}
});

bot.on("messageReactionAdd", async (message, emoji, userID) => {
	let isAdmin = ~bot.guilds.get(settings.server).members.get(userID).roles.indexOf(settings.admin);
	if(message.channel.id === settings.suggest && isAdmin) {
		let data = await getData(message.id);
		await deleteData(message.id);
		await bot.deleteMessage(message.channel.id, message.id);
		if(emoji.name === "✅") {
			let msg = await bot.createMessage(settings.vote, `<:${data.name}:${data.emojiID}>`);
			await msg.addReaction("✅");
			await msg.addReaction("❌");
			await addData({ id: msg.id, emojiID: data.emojiID, name: data.name, type: "vote", user: data.user });
		} else if(emoji.name === "❌") {
			await bot.createMessage(settings.changes, `Denied <:${data.name}:${data.emojiID}> (during approval)`);
			await userbot.deleteGuildEmoji(settings.server, data.emojiID);
		} else {
			message.removeReaction(emoji.id ? `${emoji.name}:${emoji.id}` : emoji.name, userID);
		}
	} else if(message.channel.id === settings.vote) {
		if(emoji.name === "✅") {
			if(!isAdmin) return;
			let data = await getData(message.id);
			await deleteData(message.id);
			await bot.deleteMessage(message.channel.id, message.id);

			if(data.manual) await bot.createMessage(settings.changes, `Kept <:${data.name}:${data.emojiID}> as an emote`);
			else await bot.createMessage(settings.changes, `Accepted <:${data.name}:${data.emojiID}>`);
			if(data.user) bot.addGuildMemberRole(settings.server, data.user, settings.artist);
		} else if(emoji.name === "❌") {
			if(!isAdmin) return;
			let data = await getData(message.id);
			await deleteData(message.id);
			await bot.deleteMessage(message.channel.id, message.id);

			if(data.manual) await bot.createMessage(settings.changes, `Deleted <:${data.name}:${data.emojiID}> after a vote`);
			else await bot.createMessage(settings.changes, `Denied <:${data.name}:${data.emojiID}> (during vote)`);
			await userbot.deleteGuildEmoji(settings.server, data.emojiID);
		} else {
			await bot.removeMessageReaction(message.channel.id,
				message.id,
				emoji.id ? `${emoji.name}:${emoji.id}` : emoji.name,
				userID);
		}
	}
});

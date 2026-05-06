const {
	SlashCommandBuilder,
	EmbedBuilder,
	PermissionFlagsBits,
	ChannelType,
} = require('discord.js');
const {
	AudioPlayerStatus,
	VoiceConnectionStatus,
	createAudioPlayer,
	createAudioResource,
	entersState,
	getVoiceConnection,
	joinVoiceChannel,
} = require('@discordjs/voice');
const play = require('play-dl');

const radioStations = new Map();

module.exports = {
	data: new SlashCommandBuilder()
		.setName('radio')
		.setDescription('Play a radio station based on a Spotify playlist')
		.addSubcommand(subcommand =>
			subcommand
				.setName('start')
				.setDescription('Start a radio station in a voice channel')
				.addChannelOption(option =>
					option
						.setName('channel')
						.setDescription('The voice channel where the radio should play')
						.addChannelTypes(ChannelType.GuildVoice)
						.setRequired(true)
				)
				.addStringOption(option =>
					option
						.setName('playlist')
						.setDescription('Spotify playlist URL')
						.setRequired(true)
				)
				.addBooleanOption(option =>
					option
						.setName('shuffle')
						.setDescription('Shuffle the playlist before playing')
						.setRequired(false)
				)
				.addIntegerOption(option =>
					option
						.setName('max_tracks')
						.setDescription('Maximum tracks to load from the playlist')
						.setMinValue(1)
						.setMaxValue(100)
						.setRequired(false)
				)
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('stop')
				.setDescription('Stop the radio station')
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('status')
				.setDescription('Show the current radio station status')
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

	async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();

		if (subcommand === 'start') {
			return startRadio(interaction);
		}

		if (subcommand === 'stop') {
			return stopRadio(interaction);
		}

		if (subcommand === 'status') {
			return showStatus(interaction);
		}
	},
};

async function startRadio(interaction) {
	await interaction.deferReply({ ephemeral: true });

	const voiceChannel = interaction.options.getChannel('channel');
	const playlistUrl = interaction.options.getString('playlist');
	const shuffle = interaction.options.getBoolean('shuffle') ?? true;
	const maxTracks = interaction.options.getInteger('max_tracks') || 50;
	const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe();

	const permissions = voiceChannel.permissionsFor(botMember);
	if (!permissions.has([PermissionFlagsBits.Connect, PermissionFlagsBits.Speak])) {
		return interaction.editReply(`I need Connect and Speak permissions in ${voiceChannel}.`);
	}

	if (play.sp_validate(playlistUrl) !== 'playlist') {
		return interaction.editReply('Please provide a valid Spotify playlist URL.');
	}

	stopStation(interaction.guild.id);

	try {
		const playlist = await play.spotify(playlistUrl);
		if (playlist.type !== 'playlist') {
			return interaction.editReply('That Spotify URL is not a playlist.');
		}

		const allTracks = await playlist.all_tracks();
		const playableTracks = allTracks
			.filter(track => track?.playable !== false)
			.slice(0, maxTracks);

		if (playableTracks.length === 0) {
			return interaction.editReply('I could not find playable tracks in that playlist.');
		}

		const stationTracks = shuffle ? shuffleTracks(playableTracks) : playableTracks;
		const player = createAudioPlayer();
		const connection = joinVoiceChannel({
			channelId: voiceChannel.id,
			guildId: interaction.guild.id,
			adapterCreator: interaction.guild.voiceAdapterCreator,
			selfDeaf: true,
		});

		const station = {
			connection,
			player,
			playlistName: playlist.name,
			playlistUrl,
			voiceChannelId: voiceChannel.id,
			textChannelId: interaction.channel.id,
			tracks: stationTracks,
			index: 0,
			current: null,
			stopped: false,
		};

		radioStations.set(interaction.guild.id, station);
		connection.subscribe(player);

		player.on(AudioPlayerStatus.Idle, () => {
			playNext(interaction.guild, station).catch(error => {
				console.error('Radio playback error:', error);
			});
		});

		player.on('error', error => {
			console.error('Radio audio player error:', error);
			playNext(interaction.guild, station).catch(nextError => {
				console.error('Radio playback recovery failed:', nextError);
			});
		});

		connection.on(VoiceConnectionStatus.Disconnected, async () => {
			try {
				await Promise.race([
					entersState(connection, VoiceConnectionStatus.Signalling, 5000),
					entersState(connection, VoiceConnectionStatus.Connecting, 5000),
				]);
			} catch {
				stopStation(interaction.guild.id);
			}
		});

		await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
		await playNext(interaction.guild, station);

		const embed = new EmbedBuilder()
			.setColor(0x1DB954)
			.setTitle('Radio Station Started')
			.setDescription(`Playing **${playlist.name}** in ${voiceChannel}.`)
			.addFields(
				{ name: 'Tracks Loaded', value: `${station.tracks.length}`, inline: true },
				{ name: 'Shuffle', value: shuffle ? 'On' : 'Off', inline: true }
			)
			.setFooter({ text: 'Spotify is used as the playlist source; audio is resolved from playable streams.' })
			.setTimestamp();

		return interaction.editReply({ embeds: [embed] });
	} catch (error) {
		console.error('Error starting radio:', error);
		stopStation(interaction.guild.id);
		return interaction.editReply('I could not start the radio station. Check the Spotify playlist URL and try again.');
	}
}

async function stopRadio(interaction) {
	const stopped = stopStation(interaction.guild.id);

	if (!stopped) {
		return interaction.reply({
			content: 'No radio station is currently playing.',
			ephemeral: true,
		});
	}

	return interaction.reply({
		content: 'Radio station stopped.',
		ephemeral: true,
	});
}

async function showStatus(interaction) {
	const station = radioStations.get(interaction.guild.id);

	if (!station) {
		return interaction.reply({
			content: 'No radio station is currently playing.',
			ephemeral: true,
		});
	}

	const current = station.current
		? `${station.current.name} - ${formatArtists(station.current)}`
		: 'Loading the next track...';

	const embed = new EmbedBuilder()
		.setColor(0x1DB954)
		.setTitle('Radio Station Status')
		.setDescription(`Playlist: **${station.playlistName}**`)
		.addFields(
			{ name: 'Voice Channel', value: `<#${station.voiceChannelId}>`, inline: true },
			{ name: 'Tracks Loaded', value: `${station.tracks.length}`, inline: true },
			{ name: 'Now Playing', value: current }
		)
		.setTimestamp();

	return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function playNext(guild, station) {
	if (station.stopped) return;
	if (station.index >= station.tracks.length) {
		station.index = 0;
		station.tracks = shuffleTracks(station.tracks);
	}

	const track = station.tracks[station.index++];
	station.current = track;

	const query = `${track.name} ${formatArtists(track)} audio`;
	const results = await play.search(query, {
		limit: 1,
		source: { youtube: 'video' },
	});

	if (!results.length) {
		return playNext(guild, station);
	}

	const stream = await play.stream(results[0].url);
	const resource = createAudioResource(stream.stream, {
		inputType: stream.type,
		metadata: {
			title: track.name,
			artists: formatArtists(track),
			url: track.url,
		},
	});

	station.player.play(resource);
}

function stopStation(guildId) {
	const station = radioStations.get(guildId);
	const connection = getVoiceConnection(guildId);

	if (!station && !connection) return false;

	if (station) {
		station.stopped = true;
		station.player.stop(true);
		station.connection.destroy();
		radioStations.delete(guildId);
	} else if (connection) {
		connection.destroy();
	}

	return true;
}

function formatArtists(track) {
	return track.artists?.map(artist => artist.name).join(', ') || 'Unknown Artist';
}

function shuffleTracks(tracks) {
	const shuffled = [...tracks];

	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}

	return shuffled;
}

module.exports.radioStations = radioStations;

import petitio from 'petitio';
import { getTracks, getData, Tracks } from 'spotify-url-info';
import { Track, LavalinkTrackResponse, SpotifyAlbum, SpotifyArtist, SpotifyPlaylist, SpotifyTrack, UnresolvedTrack, SpotifyEpisode, SpotifyShow } from '../typings';
import Util from '../Util';
import Node from './Node';
export default class Resolver {
    public client = this.node.client;
    public cache = new Map<string, Track>();

    public constructor(public node: Node) { }

    public get token(): string {
        return this.client.token!;
    }

    public get playlistLoadLimit(): number {
        return this.client.options.playlistLoadLimit!;
    }

    public get autoResolve(): boolean {
        return this.client.options.autoResolve!;
    }

    public async getTrack(id: string): Promise<LavalinkTrackResponse | any> {
        if (this.client.options.fetchStrategy === 'SCRAPE') {
            const tracks = await getTracks(`https://open.spotify.com/track/${id}`);
            const unresolvedTracks = this.buildUnresolved(tracks[0]);
            return this.buildResponse('TRACK_LOADED', this.autoResolve ? ([await unresolvedTracks.resolve()] as Track[]) : [unresolvedTracks]);
        }
        if (!this.token) throw new Error('No Spotify access token.');
        const spotifyTrack: SpotifyTrack = await petitio(`${this.client.baseURL}/tracks/${id}`).header('Authorization', this.token).json();
        const unresolvedTrack = this.buildUnresolved(spotifyTrack as Tracks);
        return this.buildResponse('TRACK_LOADED', this.autoResolve ? ([await unresolvedTrack.resolve()] as Track[]) : [unresolvedTrack]);
    }

    public async getPlaylist(id: string): Promise<LavalinkTrackResponse | any> {
        if (this.client.options.fetchStrategy === 'SCRAPE') {
            const tracks = await getTracks(`https://open.spotify.com/playlist/${id}`);
            const metaData = await getData(`https://open.spotify.com/playlist/${id}`);
            let unresolvedPlaylistTracks;
            // @ts-expect-error no typings
            if (typeof tracks[0].track === 'object') {
                // @ts-expect-error no typings
                unresolvedPlaylistTracks = tracks.filter(x => x.track).map(track => this.buildUnresolved(track.track));
            } else {
                // @ts-expect-error no typings
                unresolvedPlaylistTracks = tracks.filter(x => x.track).map(track => this.buildUnresolved(track));
            }
            return this.buildResponse('PLAYLIST_LOADED', this.autoResolve ? ((await Promise.all(unresolvedPlaylistTracks.map((x: { resolve: () => any; }) => x.resolve()))).filter(Boolean) as Track[]) : unresolvedPlaylistTracks, metaData.name);
        }
        if (!this.token) throw new Error('No Spotify access token.');
        const spotifyPlaylist: SpotifyPlaylist = await petitio(`${this.client.baseURL}/playlists/${id}`).header('Authorization', this.token).json();
        await this.getPlaylistTracks(spotifyPlaylist);
        const unresolvedPlaylistTracks = spotifyPlaylist.tracks.items.filter((x) => x.track !== null).map((x) => this.buildUnresolved(x.track as Tracks));
        return this.buildResponse('PLAYLIST_LOADED', this.autoResolve ? ((await Promise.all(unresolvedPlaylistTracks.map((x: any) => x.resolve()))).filter(Boolean) as Track[]) : unresolvedPlaylistTracks, spotifyPlaylist.name);
    }

    public async getAlbum(id: string): Promise<LavalinkTrackResponse | any> {
        if (this.client.options.fetchStrategy === 'SCRAPE') {
            const tracks = await getTracks(`https://open.spotify.com/album/${id}`);
            const metaData = await getData(`https://open.spotify.com/album/${id}`);
            const unresolvedAlbumTracks = tracks.map((track: any) => track && this.buildUnresolved(track)) ?? [];
            return this.buildResponse('PLAYLIST_LOADED', this.autoResolve ? ((await Promise.all(unresolvedAlbumTracks.map((x: { resolve: () => any; }) => x.resolve()))).filter(Boolean) as Track[]) : unresolvedAlbumTracks, metaData.name);
        }
        if (!this.token) throw new Error('No Spotify access token.');
        const spotifyAlbum: SpotifyAlbum = await petitio(`${this.client.baseURL}/albums/${id}`, 'GET').header('Authorization', this.token).json();
        const unresolvedAlbumTracks = spotifyAlbum?.tracks.items.map((track) => this.buildUnresolved(track as Tracks)) ?? [];
        return this.buildResponse('PLAYLIST_LOADED', this.autoResolve ? ((await Promise.all(unresolvedAlbumTracks.map((x) => x.resolve()))).filter(Boolean) as Track[]) : unresolvedAlbumTracks, spotifyAlbum.name);
    }

    public async getArtist(id: string): Promise<LavalinkTrackResponse | any> {
        if (this.client.options.fetchStrategy === 'SCRAPE') {
            const tracks = await getTracks(`https://open.spotify.com/artist/${id}`);
            const metaData = await getData(`https://open.spotify.com/artist/${id}`);
            const unresolvedArtistTracks = tracks.map((track: any) => track && this.buildUnresolved(track)) ?? [];
            return this.buildResponse('PLAYLIST_LOADED', this.autoResolve ? ((await Promise.all(unresolvedArtistTracks.map((x: { resolve: () => any; }) => x.resolve()))).filter(Boolean) as Track[]) : unresolvedArtistTracks, metaData.name);
        }
        if (!this.token) throw new Error('No Spotify access token.');
        const metaData = await petitio(`${this.client.baseURL}/artists/${id}`).header('Authorization', this.token).json();
        const spotifyArtis: SpotifyArtist = await petitio(`${this.client.baseURL}/artists/${id}/top-tracks`).query('country', 'US').header('Authorization', this.token).json();
        const unresolvedArtistTracks = spotifyArtis.tracks.map(track => track && this.buildUnresolved(track as Tracks)) ?? [];
        return this.buildResponse('PLAYLIST_LOADED', this.autoResolve ? ((await Promise.all(unresolvedArtistTracks.map((x) => x.resolve()))).filter(Boolean) as Track[]) : unresolvedArtistTracks, metaData.name);

    }

    public async getEpisode(id: string): Promise<LavalinkTrackResponse | any> {
        if (this.client.options.fetchStrategy === 'SCRAPE') {
            const tracks = await getTracks(`https://open.spotify.com/episode/${id}`);
            const metaData = await getData(`https://open.spotify.com/episode/${id}`);
            const unresolvedEpisodeTracks = tracks.map((track: any) => track && this.buildUnresolved(track)) ?? [];
            return this.buildResponse('PLAYLIST_LOADED', this.autoResolve ? ((await Promise.all(unresolvedEpisodeTracks.map((x: { resolve: () => any; }) => x.resolve()))).filter(Boolean) as Track[]) : unresolvedEpisodeTracks, metaData.name);
        }
        if (!this.token) throw new Error('No Spotify access token.');
        const metaData: SpotifyEpisode = await petitio(`${this.client.baseURL}/episodes/${id}`, 'GET').query('market', 'US').header('Authorization', this.token).json();
        return this.getShow(metaData.show.id);
    }

    public async getShow(id: string): Promise<LavalinkTrackResponse | any> {
        if (this.client.options.fetchStrategy === 'SCRAPE') {
            const tracks = await getTracks(`https://open.spotify.com/show/${id}`);
            const metaData = await getData(`https://open.spotify.com/show/${id}`);
            const unresolvedShowEpisodes = tracks.map((track: any) => track && this.buildUnresolved(track)) ?? [];
            return this.buildResponse('PLAYLIST_LOADED', this.autoResolve ? ((await Promise.all(unresolvedShowEpisodes.map((x: { resolve: () => any; }) => x.resolve()))).filter(Boolean) as Track[]) : unresolvedShowEpisodes, metaData.name);
        }
        if (!this.token) throw new Error('No Spotify access token.');
        const spotifyShow: SpotifyShow = await petitio(`${this.client.baseURL}/shows/${id}`).query('market', 'US').header('Authorization', this.token).json();
        await this.getShowEpisodes(spotifyShow);
        const unresolvedShowEpisodes = spotifyShow.episodes.items.map((x) => this.buildUnresolved(x as any));
        return this.buildResponse('PLAYLIST_LOADED', this.autoResolve ? ((await Promise.all(unresolvedShowEpisodes.map((x) => x.resolve()))).filter(Boolean) as Track[]) : unresolvedShowEpisodes, spotifyShow.name);
    }

    private async getShowEpisodes(spotifyShow: SpotifyShow): Promise<void> {
        let nextPage = spotifyShow.episodes.next;
        let pageLoaded = 1;
        while (nextPage && (this.playlistLoadLimit === 0 ? true : pageLoaded < this.playlistLoadLimit)) {
            const spotifyEpisodePage: SpotifyShow['episodes'] = await petitio(nextPage).header('Authorization', this.token).json();

            spotifyShow.episodes.items.push(...spotifyEpisodePage.items);
            nextPage = spotifyEpisodePage.next;
            pageLoaded++;
        }
    }

    private async getPlaylistTracks(spotifyPlaylist: SpotifyPlaylist): Promise<void> {
        let nextPage = spotifyPlaylist.tracks.next;
        let pageLoaded = 1;
        while (nextPage && (this.playlistLoadLimit === 0 ? true : pageLoaded < this.playlistLoadLimit)) {
            const spotifyPlaylistPage: SpotifyPlaylist['tracks'] = await petitio(nextPage).header('Authorization', this.token).json();

            spotifyPlaylist.tracks.items.push(...spotifyPlaylistPage.items);
            nextPage = spotifyPlaylistPage.next;
            pageLoaded++;
        }
    }

    private async resolve(unresolvedTrack: UnresolvedTrack): Promise<Track | undefined> {
        const cached = this.cache.get(unresolvedTrack.info.identifier);
        if (cached) return Util.structuredClone(cached);

        const lavaTrack = await this.retrieveTrack(unresolvedTrack);
        if (lavaTrack) {
            if (this.client.options.useSpotifyMetadata) {
                Object.assign(lavaTrack.info, {
                    title: unresolvedTrack.info.title,
                    author: unresolvedTrack.info.author,
                    uri: unresolvedTrack.info.uri
                });
            }
            this.cache.set(unresolvedTrack.info.identifier, Object.freeze(lavaTrack));
        }
        return Util.structuredClone(lavaTrack);
    }

    private async retrieveTrack(unresolvedTrack: UnresolvedTrack): Promise<Track | undefined> {
        const params = new URLSearchParams({ identifier: `ytsearch:${unresolvedTrack.info.author} - ${unresolvedTrack.info.title} ${this.client.options.audioOnlyResults ? 'Audio' : ''}` });
        const response: LavalinkTrackResponse<Track> = await petitio(`http${this.node.secure ? 's' : ''}://${this.node.url}/loadtracks?${params.toString()}`).header('Authorization', this.node.auth).json();
        return response.tracks[0];
    }

    private buildUnresolved(spotifyTrack: Tracks): UnresolvedTrack {
        const _this = this; // eslint-disable-line
        return {
            info: {
                identifier: spotifyTrack.id,
                title: spotifyTrack.name,
                author: spotifyTrack.artists ? spotifyTrack.artists.map((x: { name: any; }) => x.name).join(' ') : undefined ?? '',
                uri: spotifyTrack.external_urls.spotify,
                length: spotifyTrack.duration_ms
            },
            resolve(): Promise<Track | undefined> {
                return _this.resolve(this);
            }
        };
    }
    
    private buildResponse(loadtype: LavalinkTrackResponse['loadtype'], tracks: Array<UnresolvedTrack | Track> = [], playlistName?: string, exceptionMsg?: string): LavalinkTrackResponse {
        return Object.assign(
            {
                loadtype,
                tracks,
                playlistInfo: { name: playlistName }
            },
            exceptionMsg ? { exception: { message: exceptionMsg, severity: 'COMMON' } } : {}
        );
    }
}

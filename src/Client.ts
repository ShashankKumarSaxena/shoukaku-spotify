import { ClientOptions, NodeOptions } from './typings';
import Node from './structures/Node';
import Util from './Util';
import petitio from 'petitio';
import { DefaultClientOptions, DefaultNodeOptions } from './Constants';

export default class SpotifyClient {
    /** The provided options when the class was instantiated */
    public options: Readonly<ClientOptions>;
    /** The {@link Node}s are stored here */
    public nodes = new Map<string, Node>();
    /** Spotify API base URL */
    public readonly baseURL!: string;
    /** A RegExp that will be used for validate and parse URLs */
    public readonly spotifyPattern!: RegExp;
    /** The token to access the Spotify API */
    public readonly token!: string | null;


    private nextRequest?: NodeJS.Timeout;

    public constructor(options: ClientOptions, nodesOpt: NodeOptions[]) {
        Object.defineProperty(this, 'baseURL', {
            enumerable: true,
            value: 'https://api.spotify.com/v1'
        });
        Object.defineProperty(this, 'spotifyPattern', {
            value: /^(?:https:\/\/open\.spotify\.com\/(?:user\/[A-Za-z0-9]+\/)?|spotify:)(album|playlist|track|artist|episode|show)(?:[/:])([A-Za-z0-9]+).*$/
        });
        Object.defineProperty(this, 'token', {
            configurable: true,
            value: null
        });

        this.options = Object.freeze(Util.mergeDefault(DefaultClientOptions, options));
        for (const nodeOpt of nodesOpt) this.addNode(nodeOpt);
    }

    public addNode(options: NodeOptions): void {
        this.nodes.set(options.name, new Node(this, Util.mergeDefault(DefaultNodeOptions, options)));
    }

    public removeNode(id: string): boolean {
        if (!this.nodes.size) throw new Error('No nodes available, please add a node first...');
        if (!id) throw new Error('Provide a valid node identifier to delete it');

        return this.nodes.delete(id);
    }

    /**
     * @param {string} [id] The node id, if not specified it will return a random node. 
     */
    public getNode(id?: string): Node | undefined {
        if (!this.nodes.size) throw new Error('No nodes available, please add a node first...');

        if (!id) return [...this.nodes.values()].sort(() => 0.5 - Math.random())[0];

        return this.nodes.get(id);
    }

    /** Determine the URL is a valid Spotify URL or not */
    public isValidURL(url: string): boolean {
        return this.spotifyPattern.test(url);
    }

    /** A method to retrieve the Spotify API token. (this method only needs to be invoked once after the {@link SpotifyClient} instantiated) */
    public async requestToken(): Promise<void> {
        if (this.nextRequest) return;

        try {
            const request = await petitio('https://accounts.spotify.com/api/token', 'POST')
                .header({
                    Authorization: `Basic ${Buffer.from(this.options.clientID + ":" + this.options.clientSecret).toString("base64")}`, // eslint-disable-line
                    'Content-Type': 'application/x-www-form-urlencoded'
                }).body('grant_type=client_credentials').send();

            if (request.statusCode === 400) return Promise.reject(new Error('Invalid Spotify Client'));
            const { access_token, token_type, expires_in }: { access_token: string; token_type: string; expires_in: number } = request.json();
            Object.defineProperty(this, 'token', {
                value: `${token_type} ${access_token}`
            });
            Object.defineProperty(this, 'nextRequest', {
                configurable: true,
                value: setTimeout(() => {
                    delete this.nextRequest;
                    void this.requestToken();
                }, expires_in * 1000)
            });
        } catch (e: any) {
            if (e.statusCode === 400) {
                return Promise.reject(new Error('Invalid Spotify client.'));
            }
            await this.requestToken();
        }
    }
}

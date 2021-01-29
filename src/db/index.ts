import {PoolClient, QueryArrayResult} from "pg";

const {Pool} = require('pg')
const pool = new Pool()
module.exports = {
    query: async function (text: String, params: String): Promise<QueryArrayResult> {
        const start = Date.now()
        const res = await pool.query(text, params)
        const duration = Date.now() - start
        // @ts-ignore
        if (global.debug)
            console.log('executed query', {text, duration, rows: res.rowCount})
        return res
    },
    getClient: async function (): Promise<PoolClient> {
        const client = await pool.connect()
        const query = client.query
        const release = client.release
        // set a timeout of 5 seconds, after which we will log this client's last query
        const timeout = setTimeout(() => {
            console.error('A client has been checked out for more than 5 seconds!')
            console.error(`The last executed query on this client was: ${client.lastQuery}`)
        }, 5000)
        // monkey patch the query method to keep track of the last query executed
        client.query = (...args: any) => {
            client.lastQuery = args
            return query.apply(client, args)
        }
        client.release = () => {
            // clear our timeout
            clearTimeout(timeout)
            // set the methods back to their old un-monkey-patched version
            client.query = query
            client.release = release
            return release.apply(client)
        }
        return client
    }
}
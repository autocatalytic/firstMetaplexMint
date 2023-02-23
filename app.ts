import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { 
    Metaplex, 
    keypairIdentity, 
    bundlrStorage, 
    toMetaplexFile, 
    toBigNumber } from "@metaplex-foundation/js";
import * as fs from 'fs';
import secret from './guideSecret.json'; // need to create this first

// Use devnet instead of quicknode, but QN worth a try in future
const QUICKNODE_RPC = 'https://api.devnet.solana.com/'
const SOLANA_CONNECTION = new Connection(QUICKNODE_RPC);
const WALLET = Keypair.fromSecretKey(new Uint8Array(secret));

const METAPLEX = Metaplex.make(SOLANA_CONNECTION)
    .use(keypairIdentity(WALLET))
    .use(bundlrStorage({
        address: 'https://devnet.bundlr.network', /* TODO arweave bundlr?? */
        providerUrl: QUICKNODE_RPC,
        timeout: 60000,
    }));

const CONFIG = {
    uploadPath: 'uploads/',
    imgFileName: 'image0.jpeg',
    imgType: 'image/jpeg',
    imgName: 'Dreams of Summer',
    description: 'When you need the rain but the cold has you down',
    attributes: [   // no idea what these attribs mean
        {trait_type: 'Speed', value: 'Medium'},
        {trait_type: 'Type', value: 'Outdoor'},
        {trait_type: 'Background', value: 'QuickNode Blue'}
    ],
    sellerFeeBasisPoints: 500, //500 bp = 5%
    symbol: 'DOSPIX',   // Dreams of Summer Pictures
    creators: [
        {address: WALLET.publicKey, share: 100}
    ]
};

// Upload our image to decentralized storage
async function uploadImage(filePath: string,fileName: string): Promise<string>  {
    console.log(`Step 1 - Uploading Image`);

    // use filesystem to create a buffer, into which we can upload image
    const imgBuffer = fs.readFileSync(filePath+fileName);

    // to use metaplex uploader, buffer gets converted to metaplexFile
    const imgMetaplexFile = toMetaplexFile(imgBuffer,fileName);

    // use Metaplex method storage().upload() to upload. Because we have set
    // bundlr as our storage provider, this function will upload to Arweave
    const imgUri = await METAPLEX.storage().upload(imgMetaplexFile);
    console.log(`   Image URI:`,imgUri);
    return imgUri;
}

async function uploadMetadata(imgUri: string, imgType: string, nftName: string,
    description: string, attributes: { trait_type: string, value: string }[]) {
        
        console.log("Step 2 - Uploading Metadata");
     const { uri } = await METAPLEX
        .nfts()
        .uploadMetadata({
            name: nftName,
            description: description,
            image: imgUri,
            attributes: attributes,
            properties: {
                files: [
                    {
                        type: imgType,
                        uri: imgUri,
                    },
                ]
            }
        });
        console.log('   Metadata URI:',uri);
        return uri;  
    }

async function mintNft(
    metadataUri: string
    ,name: string
    ,sellerFee: number
    ,symbol: string
    ,creators: {
        address: PublicKey, 
        share: number}[]
    ) {  
        console.log("Step 3 - Minting NFT");

        // Inside this mint function, call Metaplex.make we primed above
        // sending across the additional parameters we now know
        const { nft } = await METAPLEX
        .nfts()
        .create({
          uri: metadataUri,
          name: name,
          sellerFeeBasisPoints: sellerFee,
          symbol: symbol,
          creators: creators,
          isMutable: false,
          maxSupply: toBigNumber(1)
        });
    console.log(`   Success!🎉`);
    console.log(`   Minted NFT: https://explorer.solana.com/address/${nft.address}?cluster=devnet`);

}


async function main() {
    console.log(`Minting ${CONFIG.imgName} to an NFT in Wallet ${WALLET.publicKey.toBase58()}.`);

    //Step 1 - Upload Image
    const imgUri = await uploadImage(CONFIG.uploadPath, CONFIG.imgFileName);

    //Step 2 - Upload Metadata
    const metadataUri = await uploadMetadata(imgUri, CONFIG.imgType, CONFIG.imgName, 
        CONFIG.description, CONFIG.attributes); 

    //Step 3 - Mint NFT!!
    mintNft(
        metadataUri, 
        CONFIG.imgName, 
        CONFIG.sellerFeeBasisPoints, 
        CONFIG.symbol, 
        CONFIG.creators,
    );
}

main();

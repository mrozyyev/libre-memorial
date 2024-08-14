import PocketBase from 'pocketbase';

const pb = new PocketBase('https://librememorial.pockethost.io');


const authData = await pb.collection('users').authWithOAuth2({ provider: 'google' });

// OR authenticate with manual OAuth2 code exchange
// const authData = await pb.collection('users').authWithOAuth2Code(...);

// after the above you can also access the auth data from the authStore
console.log(pb.authStore.isValid);
console.log(pb.authStore.token);
console.log(pb.authStore.model.id);

// "logout" the last authenticated model
pb.authStore.clear();

export default pb;

import { Head } from "$fresh/runtime.ts";
import AuthManager from "../islands/AuthManager.tsx";

export default function Home() {
  return (
    <>
      <Head>
        <title>YouTube Integration - OAuth Test</title>
      </Head>
      <div class="px-4 py-8 mx-auto bg-[#86efac]">
        <div class="max-w-screen-md mx-auto flex flex-col items-center justify-center">
          <h1 class="text-4xl font-bold">YouTube Integration</h1>
          <p class="my-4">OAuth Authentication with Preact Signals</p>

          <div class="mt-8 w-full max-w-md">
            <AuthManager 
              showUserProfile={true}
              showTokenExpiry={true}
            />
          </div>
        </div>
      </div>
    </>
  );
}

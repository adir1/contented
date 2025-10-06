import { Head } from "$fresh/runtime.ts";

export default function Home() {
  return (
    <>
      <Head>
        <title>YouTube Integration - OAuth Test</title>
      </Head>
      <div class="px-4 py-8 mx-auto bg-[#86efac]">
        <div class="max-w-screen-md mx-auto flex flex-col items-center justify-center">
          <h1 class="text-4xl font-bold">YouTube Integration</h1>
          <p class="my-4">OAuth Authentication Test</p>

          <div class="flex gap-4 mt-8">
            <a
              href="/api/auth/login"
              class="px-8 py-4 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Login with Google
            </a>

            <button
              type="button"
              id="logout-btn"
              class="px-8 py-4 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Logout
            </button>

            <button
              type="button"
              id="status-btn"
              class="px-8 py-4 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              Check Status
            </button>
          </div>

          <div
            id="status"
            class="mt-8 p-4 bg-white rounded shadow-lg min-h-[100px] w-full max-w-md"
          >
            <p class="text-gray-600">
              Click "Check Status" to see authentication status
            </p>
          </div>
        </div>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `
          async function logout() {
            try {
              const response = await fetch('/api/auth/logout', {
                method: 'POST',
              });
              const result = await response.json();
              document.getElementById('status').innerHTML = '<pre>' + JSON.stringify(result, null, 2) + '</pre>';
            } catch (error) {
              document.getElementById('status').innerHTML = '<p class="text-red-600">Logout error: ' + error.message + '</p>';
            }
          }
          
          async function checkStatus() {
            try {
              const response = await fetch('/api/auth/status');
              const result = await response.json();
              document.getElementById('status').innerHTML = '<pre>' + JSON.stringify(result, null, 2) + '</pre>';
            } catch (error) {
              document.getElementById('status').innerHTML = '<p class="text-red-600">Status check error: ' + error.message + '</p>';
            }
          }
          
          // Add event listeners
          document.addEventListener('DOMContentLoaded', function() {
            document.getElementById('logout-btn').addEventListener('click', logout);
            document.getElementById('status-btn').addEventListener('click', checkStatus);
            
            // Check for URL parameters on page load
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('auth') === 'success') {
              document.getElementById('status').innerHTML = '<p class="text-green-600">Authentication successful!</p>';
              checkStatus();
            } else if (urlParams.get('error')) {
              document.getElementById('status').innerHTML = '<p class="text-red-600">Authentication error: ' + urlParams.get('error') + '</p>';
            }
          });
        `,
        }}
      />
    </>
  );
}

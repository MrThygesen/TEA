//frontend/pages/email-verified.js
import EmailVerified from '../components/EmailVerified'

export default function EmailVerifiedPage({ token }) {
  return <EmailVerified token={token} />
}

export async function getServerSideProps(context) {
  const { token } = context.query

  if (!token) {
    return {
      notFound: true,
    }
  }

  return {
    props: {
      token,
    },
  }
}



-f frontend/pages/email-verified.js -f 

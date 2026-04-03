import LoginForm from "./login-form";
import { isRegistrationEnabled } from "@/lib/feature-flags";

const LoginPage = () => {
  return <LoginForm registrationEnabled={isRegistrationEnabled()} />;
};

export default LoginPage;

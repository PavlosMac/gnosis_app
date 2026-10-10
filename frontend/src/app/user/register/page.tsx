import LegalDocument from "@/components/LegalDocument";
import RegisterForm from "./register-form";

// Server page: the legal documents are rendered here and handed to the client
// form as ready nodes, so their text never ships as client JS.
const RegisterPage = () => (
  <RegisterForm
    terms={<LegalDocument id="terms" />}
    privacy={<LegalDocument id="privacy" />}
  />
);

export default RegisterPage;

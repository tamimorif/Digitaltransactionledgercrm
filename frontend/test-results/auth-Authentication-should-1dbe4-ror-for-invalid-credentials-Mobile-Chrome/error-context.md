# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - heading "Login to System" [level=4] [ref=e5]
      - paragraph [ref=e6]: Enter your email and password
    - generic [ref=e8]:
      - generic [ref=e9]:
        - generic [ref=e10]:
          - generic [ref=e11]: Email or Username
          - textbox "Email or Username" [ref=e12]:
            - /placeholder: Enter your email or username
        - generic [ref=e13]:
          - generic [ref=e14]:
            - generic [ref=e15]: Password
            - link "Forgot Password?" [ref=e16] [cursor=pointer]:
              - /url: /forgot-password
          - textbox "Password" [ref=e17]:
            - /placeholder: ••••••••
        - button "Login" [ref=e18]
      - paragraph [ref=e20]:
        - text: Don't have an account?
        - link "Sign up" [ref=e21] [cursor=pointer]:
          - /url: /register
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e27] [cursor=pointer]:
    - img [ref=e28]
  - alert [ref=e31]
```
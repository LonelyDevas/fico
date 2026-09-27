import { ProfilePageContent } from '@/components/page/profile/profile-page'
import { IonContent, IonPage } from '@ionic/react'

export default function ProfilePage() {
  return (
    <IonPage>
      <IonContent className="bg-background text-foreground">
        <ProfilePageContent />
      </IonContent>
    </IonPage>
  )
}
